/**
 * T073/002-shared-grc-foundation, US3 — `FindingController`:
 * `contracts/grc-foundation.openapi.yaml`'s `/findings` and
 * `/findings/{findingId}[/close|/reopen|/archive]` paths (`listFindings`,
 * `createFinding`, `getFinding`, `updateFinding`, `closeFinding`,
 * `reopenFinding`, `archiveFinding`). Every route carries its own
 * `@RequirePermission` (FR-033) — there is no route on this controller
 * without one, and no `DELETE` route exists (FR-027: findings are
 * archived, never physically deleted).
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
import { ArchiveFindingUseCase } from '../application/archive-finding.usecase';
import { CloseFindingUseCase } from '../application/close-finding.usecase';
import { CreateFindingUseCase } from '../application/create-finding.usecase';
import { GetFindingUseCase } from '../application/get-finding.usecase';
import { ListFindingUseCase } from '../application/list-finding.usecase';
import { ReopenFindingUseCase } from '../application/reopen-finding.usecase';
import { StartFindingRemediationUseCase } from '../application/start-remediation.usecase';
import { UpdateFindingUseCase } from '../application/update-finding.usecase';

import { CloseFindingRequestDto } from './dto/close-finding-request.dto';
import { CreateFindingRequestDto } from './dto/create-finding-request.dto';
import { toFindingResponse, type FindingResponse } from './dto/finding-response.mapper';
import { ListFindingQueryDto } from './dto/list-finding-query.dto';
import { ReopenFindingRequestDto } from './dto/reopen-finding-request.dto';
import { UpdateFindingRequestDto } from './dto/update-finding-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface FindingPageResponse {
  readonly items: readonly FindingResponse[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

@Controller('findings')
export class FindingController {
  constructor(
    private readonly createFindingUseCase: CreateFindingUseCase,
    private readonly listFindingUseCase: ListFindingUseCase,
    private readonly getFindingUseCase: GetFindingUseCase,
    private readonly updateFindingUseCase: UpdateFindingUseCase,
    private readonly closeFindingUseCase: CloseFindingUseCase,
    private readonly reopenFindingUseCase: ReopenFindingUseCase,
    private readonly archiveFindingUseCase: ArchiveFindingUseCase,
    private readonly startFindingRemediationUseCase: StartFindingRemediationUseCase,
  ) {}

  @RequirePermission('finding:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListFindingQueryDto,
  ): Promise<FindingPageResponse> {
    const result = await this.listFindingUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      severity: query.severity,
      ownerUserId: query.ownerUserId,
      orgUnitId: query.orgUnitId,
      withoutRemediation: query.withoutRemediation,
    });

    return {
      items: result.items.map((item) => toFindingResponse(item)),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  @RequirePermission('finding:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateFindingRequestDto,
  ): Promise<FindingResponse> {
    const record = await this.createFindingUseCase.execute({
      actorUserId: session.userId,
      orgUnitId: body.orgUnitId,
      title: body.title,
      description: body.description,
      recommendation: body.recommendation,
      category: body.category,
      origin: body.origin,
      severity: body.severity,
      priority: body.priority,
      ownerUserId: body.ownerUserId,
      identifiedOn: body.identifiedOn,
    });

    return toFindingResponse(record);
  }

  @RequirePermission('finding:view')
  @Get(':findingId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
  ): Promise<FindingResponse> {
    const record = await this.getFindingUseCase.execute({
      actorUserId: session.userId,
      findingId,
    });
    return toFindingResponse(record);
  }

  @RequirePermission('finding:edit')
  @Patch(':findingId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
    @Body() body: UpdateFindingRequestDto,
  ): Promise<FindingResponse> {
    assertUpdateBodyNotEmpty(body);

    const updated = await this.updateFindingUseCase.execute({
      actorUserId: session.userId,
      findingId,
      title: body.title,
      description: body.description,
      recommendation: body.recommendation,
      category: body.category,
      severity: body.severity,
      priority: body.priority,
      ownerUserId: body.ownerUserId,
    });

    return toFindingResponse(updated);
  }

  @RequirePermission('finding:close')
  @Post(':findingId/close')
  @HttpCode(HttpStatus.OK)
  async close(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
    @Body() body: CloseFindingRequestDto,
  ): Promise<FindingResponse> {
    const closed = await this.closeFindingUseCase.execute({
      actorUserId: session.userId,
      findingId,
      justification: body.justification,
    });
    return toFindingResponse(closed);
  }

  @RequirePermission('finding:close')
  @Post(':findingId/reopen')
  @HttpCode(HttpStatus.OK)
  async reopen(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
    @Body() body: ReopenFindingRequestDto,
  ): Promise<FindingResponse> {
    const reopened = await this.reopenFindingUseCase.execute({
      actorUserId: session.userId,
      findingId,
      reason: body.reason,
    });
    return toFindingResponse(reopened);
  }

  @RequirePermission('finding:administer')
  @Post(':findingId/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
  ): Promise<FindingResponse> {
    const archived = await this.archiveFindingUseCase.execute({
      actorUserId: session.userId,
      findingId,
    });
    return toFindingResponse(archived);
  }

  /** T047/005-audit-findings, US2 — `startFindingRemediation`, the
   * operation that finally makes `OPEN -> IN_REMEDIATION` reachable
   * (SC-002, research.md D-10). No request body. */
  @RequirePermission('finding:remediate')
  @Post(':findingId/start-remediation')
  @HttpCode(HttpStatus.OK)
  async startRemediation(
    @CurrentSession() session: ValidatedSession,
    @Param('findingId', new ParseUUIDPipe()) findingId: string,
  ): Promise<FindingResponse> {
    const updated = await this.startFindingRemediationUseCase.execute({
      actorUserId: session.userId,
      findingId,
    });
    return toFindingResponse(updated);
  }
}

/** `UpdateFindingRequest`'s `minProperties: 1` — controller-level check,
 * mirroring `evidence.controller.ts#assertUpdateBodyNotEmpty`'s own
 * documented reasoning. */
function assertUpdateBodyNotEmpty(body: UpdateFindingRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.findings.updateRequestEmpty,
    });
  }
}
