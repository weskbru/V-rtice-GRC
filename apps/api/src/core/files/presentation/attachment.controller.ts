/**
 * T190 — `AttachmentController`: `/attachments` (`contracts/
 * platform.openapi.yaml`'s Attachments paths, FR-096 to FR-100).
 *
 * ## Why the GET routes carry `@NoPermissionRequired()`, never
 * `@RequirePermission(...)`
 *
 * `listAttachments`/`downloadContent` are gated by the PARENT record's own
 * view permission (`risk:view` for `entityType=RISK`), which is a value
 * only known at RUNTIME (the caller supplies `entityType` in the query
 * string, or it is read off an already-persisted `Attachment` row) — there
 * is no single, compile-time permission identifier `@RequirePermission`
 * could name for a route serving every current and future entity type.
 * `@NoPermissionRequired()` therefore admits any AUTHENTICATED caller past
 * `PermissionGuard`, and `getAttachableEntityAccessor(...)
 * .resolveViewableParent(...)` (invoked inside the use cases below, via
 * `entity-registry.ts`) performs the REAL, entity-type-specific
 * permission-plus-scope check and throws `NotFoundDomainError` on refusal
 * — matching the contract's own declared response set for these two
 * routes, which lists `404` but never `403`.
 *
 * `uploadAttachment`/`withdrawAttachment` are different: `attachment:create`/
 * `attachment:delete` are fixed, entity-type-independent permissions
 * (data-model.md §3), so a static `@RequirePermission(...)` is exactly
 * right — and the contract's response set for both DOES list `403`
 * alongside `404` (missing the action permission vs. inaccessible parent
 * are two independently possible refusals).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import {
  NoPermissionRequired,
  RequirePermission,
} from '../../authorization/presentation/permission.guard';
import { CurrentSession } from '../../identity/presentation/current-session.decorator';
import { GetAttachmentContentUseCase } from '../application/get-attachment-content.usecase';
import { ListAttachmentsUseCase } from '../application/list-attachments.usecase';
import { UploadService } from '../application/upload.service';
import { WithdrawAttachmentUseCase } from '../application/withdraw-attachment.usecase';

import { buildContentDispositionHeader } from './content-disposition';
import { toAttachmentResponse, type AttachmentResponse } from './dto/attachment-response.mapper';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { UploadAttachmentRequestDto } from './dto/upload-attachment-request.dto';

import type { ValidatedSession } from '../../sessions/application/session.service';
import type { Request, Response } from 'express';

export interface AttachmentPageResponse {
  readonly data: readonly AttachmentResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

/** The minimal shape multer's default (memory) storage populates —
 * deliberately not `Express.Multer.File` (no `@types/multer` dependency is
 * introduced for this alone; see `FileStorageProvider`'s own header for why
 * a `Buffer` is the right shape at this boundary). */
interface UploadedFileLike {
  readonly originalname: string;
  readonly mimetype: string;
  readonly buffer: Buffer;
  readonly size: number;
}

@Controller('attachments')
export class AttachmentController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly listAttachmentsUseCase: ListAttachmentsUseCase,
    private readonly withdrawAttachmentUseCase: WithdrawAttachmentUseCase,
    private readonly getAttachmentContentUseCase: GetAttachmentContentUseCase,
  ) {}

  @NoPermissionRequired()
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListAttachmentsQueryDto,
  ): Promise<AttachmentPageResponse> {
    const result = await this.listAttachmentsUseCase.execute({
      actorUserId: session.userId,
      entityType: query.entityType,
      entityId: query.entityId,
      page: query.page,
      pageSize: query.pageSize,
    });

    return {
      data: result.items.map(toAttachmentResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('attachment:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @CurrentSession() session: ValidatedSession,
    // `ValidationPipe` (global, `class-transformer`) validates
    // `entityType`/`entityId` from the multipart request's non-file
    // fields exactly as it would a JSON body (T022's global pipe applies
    // uniformly regardless of content type).
    @Body() body: UploadAttachmentRequestDto,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AttachmentResponse> {
    if (!file) {
      throw new BadRequestException({
        title: USER_MESSAGES.problemTitle.badRequest,
        detail: USER_MESSAGES.attachment.fileRequired,
      });
    }

    const attachment = await this.uploadService.execute({
      actorUserId: session.userId,
      entityType: body.entityType,
      entityId: body.entityId,
      fileName: file.originalname,
      declaredContentType: file.mimetype,
      content: file.buffer,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${attachment.id}`);

    return toAttachmentResponse(attachment);
  }

  @RequirePermission('attachment:delete')
  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async withdraw(
    @CurrentSession() session: ValidatedSession,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
  ): Promise<void> {
    await this.withdrawAttachmentUseCase.execute({
      actorUserId: session.userId,
      attachmentId,
    });
  }

  @NoPermissionRequired()
  @Get(':attachmentId/content')
  async downloadContent(
    @CurrentSession() session: ValidatedSession,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const { attachment, stream } = await this.getAttachmentContentUseCase.execute({
      actorUserId: session.userId,
      attachmentId,
    });

    // FR-099: always a download of opaque bytes, never active content —
    // every one of these four headers is required by the contract on
    // every response from this endpoint, not merely a default.
    response.set({
      'Content-Disposition': buildContentDispositionHeader(attachment.fileName),
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
      'Cache-Control': 'private, no-store',
      'Content-Type': attachment.contentType,
      'Content-Length': String(attachment.sizeBytes),
    });
    response.status(HttpStatus.OK);
    stream.pipe(response);
  }
}
