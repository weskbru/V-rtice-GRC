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
