/**
 * T034/002-shared-grc-foundation, US1 — `EvidenceController`:
 * `contracts/grc-foundation.openapi.yaml`'s `/evidence` and
 * `/evidence/{evidenceId}/**` paths (`listEvidence`, `createEvidence`,
 * `getEvidence`, `updateEvidence`, `archiveEvidence`, `listEvidenceLinks`,
 * `linkEvidence`, `unlinkEvidence`). Every route carries its own
 * `@RequirePermission` (FR-033) — there is no route on this controller
 * without one.
 *
 * No `DELETE` route exists, and never will (FR-009: evidence is archived,
 * never physically deleted) — the contract itself defines no such
 * operation.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ArchiveEvidenceUseCase } from '../application/archive-evidence.usecase';
import { CreateEvidenceUseCase } from '../application/create-evidence.usecase';
import { GetEvidenceUseCase } from '../application/get-evidence.usecase';
import { LinkEvidenceUseCase } from '../application/link-evidence.usecase';
import { ListEvidenceLinksUseCase } from '../application/list-evidence-links.usecase';
import { ListEvidenceUseCase } from '../application/list-evidence.usecase';
import { UnlinkEvidenceUseCase } from '../application/unlink-evidence.usecase';
import { UpdateEvidenceUseCase } from '../application/update-evidence.usecase';

import { CreateEvidenceRequestDto } from './dto/create-evidence-request.dto';
import {
  toEvidenceLinkResponse,
  type EvidenceLinkResponse,
} from './dto/evidence-link-response.mapper';
import { toEvidenceResponse, type EvidenceResponse } from './dto/evidence-response.mapper';
import { LinkEvidenceRequestDto } from './dto/link-evidence-request.dto';
import { ListEvidenceLinksQueryDto } from './dto/list-evidence-links-query.dto';
import { ListEvidenceQueryDto } from './dto/list-evidence-query.dto';
import { UpdateEvidenceRequestDto } from './dto/update-evidence-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface EvidencePageResponse {
  readonly items: readonly EvidenceResponse[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

@Controller('evidence')
export class EvidenceController {
  constructor(
    private readonly createEvidenceUseCase: CreateEvidenceUseCase,
    private readonly listEvidenceUseCase: ListEvidenceUseCase,
    private readonly getEvidenceUseCase: GetEvidenceUseCase,
    private readonly updateEvidenceUseCase: UpdateEvidenceUseCase,
    private readonly archiveEvidenceUseCase: ArchiveEvidenceUseCase,
    private readonly listEvidenceLinksUseCase: ListEvidenceLinksUseCase,
    private readonly linkEvidenceUseCase: LinkEvidenceUseCase,
    private readonly unlinkEvidenceUseCase: UnlinkEvidenceUseCase,
  ) {}

  @RequirePermission('evidence:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListEvidenceQueryDto,
  ): Promise<EvidencePageResponse> {
    const result = await this.listEvidenceUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      type: query.type,
      ownerUserId: query.ownerUserId,
      orgUnitId: query.orgUnitId,
      expiringBefore: query.expiringBefore,
      search: query.search,
      subjectType: query.subjectType,
      subjectId: query.subjectId,
    });

    return {
      items: result.items.map((item) => toEvidenceResponse(item)),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  @RequirePermission('evidence:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateEvidenceRequestDto,
  ): Promise<EvidenceResponse> {
    const record = await this.createEvidenceUseCase.execute({
      actorUserId: session.userId,
      orgUnitId: body.orgUnitId,
      title: body.title,
      description: body.description,
      type: body.type,
      source: body.source,
      ownerUserId: body.ownerUserId,
      collectedOn: body.collectedOn,
      validUntil: body.validUntil,
      externalUrl: body.externalUrl,
      observation: body.observation,
    });

    return toEvidenceResponse(record);
  }

  @RequirePermission('evidence:view')
  @Get(':evidenceId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('evidenceId', new ParseUUIDPipe()) evidenceId: string,
  ): Promise<EvidenceResponse> {
    const record = await this.getEvidenceUseCase.execute({
      actorUserId: session.userId,
      evidenceId,
    });
    return toEvidenceResponse(record);
  }

  @RequirePermission('evidence:edit')
  @Patch(':evidenceId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('evidenceId', new ParseUUIDPipe()) evidenceId: string,
    @Body() body: UpdateEvidenceRequestDto,
  ): Promise<EvidenceResponse> {
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateEvidenceUseCase.execute({
      actorUserId: session.userId,
      evidenceId,
      title: body.title,
      description: body.description,
      type: body.type,
      source: body.source,
      ownerUserId: body.ownerUserId,
      collectedOn: body.collectedOn,
      validUntil: body.validUntil,
      externalUrl: body.externalUrl,
      observation: body.observation,
    });

    return toEvidenceResponse(record);
  }

  @RequirePermission('evidence:administer')
  @Post(':evidenceId/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @CurrentSession() session: ValidatedSession,
    @Param('evidenceId', new ParseUUIDPipe()) evidenceId: string,
  ): Promise<EvidenceResponse> {
    const record = await this.archiveEvidenceUseCase.execute({
      actorUserId: session.userId,
      evidenceId,
    });
    return toEvidenceResponse(record);
  }

  @RequirePermission('evidence:view')
  @Get(':evidenceId/links')
  async listLinks(
    @CurrentSession() session: ValidatedSession,
    @Param('evidenceId', new ParseUUIDPipe()) evidenceId: string,
    @Query() query: ListEvidenceLinksQueryDto,
  ): Promise<readonly EvidenceLinkResponse[]> {
    const links = await this.listEvidenceLinksUseCase.execute({
      actorUserId: session.userId,
      evidenceId,
      includeUnlinked: query.includeUnlinked,
    });
    return links.map(toEvidenceLinkResponse);
  }

  @RequirePermission('evidence:link')
  @Post(':evidenceId/links')
  @HttpCode(HttpStatus.CREATED)
  async link(
    @CurrentSession() session: ValidatedSession,
    @Param('evidenceId', new ParseUUIDPipe()) evidenceId: string,
    @Body() body: LinkEvidenceRequestDto,
  ): Promise<EvidenceLinkResponse> {
    const link = await this.linkEvidenceUseCase.execute({
      actorUserId: session.userId,
      evidenceId,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      note: body.note,
    });
    return toEvidenceLinkResponse(link);
  }

  @RequirePermission('evidence:link')
  @Post(':evidenceId/links/:linkId/unlink')
  @HttpCode(HttpStatus.OK)
  async unlink(
    @CurrentSession() session: ValidatedSession,
    @Param('evidenceId', new ParseUUIDPipe()) evidenceId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
  ): Promise<EvidenceLinkResponse> {
    const link = await this.unlinkEvidenceUseCase.execute({
      actorUserId: session.userId,
      evidenceId,
      linkId,
    });
    return toEvidenceLinkResponse(link);
  }
}

/** `UpdateEvidenceRequest`'s `minProperties: 1` — controller-level check,
 * mirroring `risk.controller.ts#assertUpdateBodyNotEmpty`'s own documented
 * reasoning (a key-count check misses `class-transformer`'s
 * own-property-with-`undefined`-value behavior under this project's
 * `target: ES2023`). */
function assertUpdateBodyNotEmpty(body: UpdateEvidenceRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.evidence.updateRequestEmpty,
    });
  }
}
