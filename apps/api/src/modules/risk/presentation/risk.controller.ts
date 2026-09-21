/**
 * T092/T107/T093 — `RiskController`: create, read-by-id, update, the
 * register listing, and the causes/consequences replace endpoints, per
 * `contracts/risks.openapi.yaml`'s `/risks`, `/risks/{riskId}`,
 * `/risks/{riskId}/causes` and `/risks/{riskId}/consequences` paths
 * (`createRisk`, `getRisk`, `updateRisk`, `listRiskRegister`,
 * `replaceRiskCauses`, `replaceRiskConsequences` operations only —
 * assessment, treatment, links, lifecycle and history endpoints on the
 * same document belong to later user stories, US4-US7).
 *
 * `DELETE /risks/{riskId}` does not exist on this controller, and never
 * will (FR-102, CLAUDE.md's inviolable rule 4) — the contract itself
 * defines no such operation.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { CreateRiskUseCase } from '../application/create-risk.usecase';
import { GetRiskDetailUseCase } from '../application/get-risk-detail.usecase';
import { ListRisksUseCase } from '../application/list-risks.usecase';
import { ReplaceRiskStatementsUseCase } from '../application/replace-risk-statements.usecase';
import { UpdateRiskUseCase } from '../application/update-risk.usecase';

import { CreateRiskRequestDto } from './dto/create-risk-request.dto';
import { ListRisksQueryDto } from './dto/list-risks-query.dto';
import { ReplaceRiskStatementsRequestDto } from './dto/replace-risk-statements-request.dto';
import {
  toEmptyRiskDetailAggregate,
  toRiskDetailResponse,
  toRiskStatementResponses,
  type RiskDetailResponse,
  type RiskStatementResponse,
} from './dto/risk-response.mapper';
import {
  toRiskSummaryResponse,
  type RiskSummaryResponse,
} from './dto/risk-summary-response.mapper';
import { UpdateRiskRequestDto } from './dto/update-risk-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface RiskRegisterPageResponse {
  readonly data: readonly RiskSummaryResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('risks')
export class RiskController {
  constructor(
    private readonly createRiskUseCase: CreateRiskUseCase,
    private readonly getRiskDetailUseCase: GetRiskDetailUseCase,
    private readonly updateRiskUseCase: UpdateRiskUseCase,
    private readonly listRisksUseCase: ListRisksUseCase,
    private readonly replaceRiskStatementsUseCase: ReplaceRiskStatementsUseCase,
  ) {}

  /**
   * T107 — `GET /risks`: the risk register (US3,
   * `contracts/risks.openapi.yaml`'s `listRiskRegister` operation).
   * Declared BEFORE `findById`'s `:riskId` route in this file so the
   * static path is visually adjacent to its query DTO — Nest itself
   * dispatches `/risks` and `/risks/:riskId` unambiguously regardless of
   * declaration order (they never overlap: one has zero path segments
   * after `risks`, the other exactly one).
   */
  @RequirePermission('risk:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListRisksQueryDto,
  ): Promise<RiskRegisterPageResponse> {
    const result = await this.listRisksUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
      riskLevel: query.riskLevel,
      riskLevelBasis: query.riskLevelBasis,
      categoryId: query.categoryId,
      orgUnitId: query.orgUnitId,
      includeDescendants: query.includeDescendants,
      ownerUserId: query.ownerUserId,
      overdueReview: query.overdueReview,
      overdueTreatment: query.overdueTreatment,
      sortField: query.sort,
      sortDirection: query.direction,
    });

    return {
      data: result.items.map(toRiskSummaryResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('risk:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateRiskRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RiskDetailResponse> {
    const record = await this.createRiskUseCase.execute({
      actorUserId: session.userId,
      title: body.title,
      description: body.description,
      categoryId: body.categoryId ?? undefined,
      typeId: body.typeId ?? undefined,
      originId: body.originId ?? undefined,
      orgUnitId: body.orgUnitId,
      ownerUserId: body.ownerUserId,
      responsibleUserId: body.responsibleUserId ?? undefined,
      identifiedOn: body.identifiedOn,
      nextReviewOn: body.nextReviewOn ?? undefined,
      causes: body.causes,
      consequences: body.consequences,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);
    response.set('ETag', formatETag(record.version));

    // A brand-new DRAFT risk provably has no treatment/links/actions yet —
    // see `toEmptyRiskDetailAggregate`'s doc comment.
    return toRiskDetailResponse(toEmptyRiskDetailAggregate(record));
  }

  @RequirePermission('risk:view')
  @Get(':riskId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RiskDetailResponse> {
    const aggregate = await this.getRiskDetailUseCase.execute({
      actorUserId: session.userId,
      riskId,
    });

    response.set('ETag', formatETag(aggregate.risk.version));

    return toRiskDetailResponse(aggregate);
  }

  @RequirePermission('risk:edit')
  @Patch(':riskId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateRiskRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RiskDetailResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateRiskUseCase.execute({
      actorUserId: session.userId,
      riskId,
      expectedVersion,
      title: body.title,
      description: body.description,
      categoryId: body.categoryId,
      typeId: body.typeId,
      originId: body.originId,
      orgUnitId: body.orgUnitId,
      ownerUserId: body.ownerUserId,
      responsibleUserId: body.responsibleUserId,
      identifiedOn: body.identifiedOn,
      nextReviewOn: body.nextReviewOn,
    });

    response.set('ETag', formatETag(record.version));

    // US6 fix (previously reported, now closed): an EXISTING risk being
    // updated may already carry a treatment decision, links or treatment
    // actions, so the `toEmptyRiskDetailAggregate` shortcut `POST /risks`
    // legitimately uses (a brand-new DRAFT risk provably has none of that
    // data yet) under-reported them here exactly like the pre-fix GET
    // handler once did. `PATCH` now re-reads the full aggregate through the
    // SAME `GetRiskDetailUseCase` `GET /risks/{riskId}` uses, so both
    // responses report identical data for the same risk (ADR-009: one
    // mapping per business concept) — one extra read after the write, the
    // same cost `CreateAssessmentUseCase`'s own callers already accept
    // elsewhere in this module for response completeness.
    const aggregate = await this.getRiskDetailUseCase.execute({
      actorUserId: session.userId,
      riskId,
    });
    return toRiskDetailResponse(aggregate);
  }

  /**
   * T093 — `PUT /risks/{riskId}/causes` (`replaceRiskCauses`, FR-057).
   * `ReplaceRiskStatementsUseCase` performs the scoped read/write and the
   * `CLOSED`/`ARCHIVED` immutability check itself (FR-025, FR-084) — this
   * controller only translates the wire shape, the `If-Match` header
   * (ADR-013) and which child table `kind: 'causes'` selects.
   */
  @RequirePermission('risk:edit')
  @Put(':riskId/causes')
  async replaceCauses(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: ReplaceRiskStatementsRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<readonly RiskStatementResponse[]> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { items, risk } = await this.replaceRiskStatementsUseCase.execute({
      actorUserId: session.userId,
      riskId,
      kind: 'causes',
      expectedVersion,
      items: body.items,
    });

    response.set('ETag', formatETag(risk.version));

    return toRiskStatementResponses(items);
  }

  /**
   * T093 — `PUT /risks/{riskId}/consequences` (`replaceRiskConsequences`,
   * FR-057). Identical shape to `replaceCauses` above, against the disjoint
   * `RiskConsequence` table (`kind: 'consequences'`).
   */
  @RequirePermission('risk:edit')
  @Put(':riskId/consequences')
  async replaceConsequences(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: ReplaceRiskStatementsRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<readonly RiskStatementResponse[]> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);

    const { items, risk } = await this.replaceRiskStatementsUseCase.execute({
      actorUserId: session.userId,
      riskId,
      kind: 'consequences',
      expectedVersion,
      items: body.items,
    });

    response.set('ETag', formatETag(risk.version));

    return toRiskStatementResponses(items);
  }
}

/** Exported for reuse by `assessment.controller.ts` (T125) — every
 * risk-mutating endpoint formats/parses `ETag`/`If-Match` identically
 * (ADR-013), so this is the one place either does it. */
export function formatETag(version: number): string {
  return `"${String(version)}"`;
}

/**
 * `If-Match` is required on every risk mutation (ADR-013): "a missing
 * header is `400`; a stale value is `409`". This function only handles the
 * `400` half (shape/presence); the `409` half is `UpdateRiskUseCase`
 * throwing `OptimisticLockDomainError` after comparing against the actual
 * row.
 */
/** Exported for reuse by `assessment.controller.ts` (T125) — see
 * `formatETag`'s doc comment above. */
export function parseIfMatchHeader(headerValue: string | undefined): number {
  if (headerValue === undefined || headerValue.trim().length === 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.risk.ifMatchRequired,
    });
  }

  const unquoted = headerValue.trim().replace(/^"|"$/g, '');
  const version = Number(unquoted);

  if (!Number.isInteger(version) || version < 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.risk.ifMatchInvalid,
    });
  }

  return version;
}

/**
 * `UpdateRiskRequest`'s `minProperties: 1` — see `UpdateRiskRequestDto`'s
 * header for why this is a controller-level check rather than a
 * class-validator decorator.
 */
function assertUpdateBodyNotEmpty(body: UpdateRiskRequestDto): void {
  // `Object.values(...).some(...)`, never `Object.keys(...).length === 0`.
  // Under this project's `target: ES2023` (so `useDefineForClassFields` is on),
  // `class-transformer`'s `plainToInstance` *defines* every declared field as an
  // own property with value `undefined`, even for fields the request omitted —
  // verified directly: `plainToInstance(Dto, {})` yields
  // `Object.keys(...) === ["title", "description", ...]`. A key-count check
  // therefore never fires, and an empty `PATCH` body was accepted: the risk's
  // `version` was bumped and an audit entry written for a change that did not
  // happen. An audit trail recording a modification that modified nothing is
  // worse than no entry at all.
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.risk.updateRequestEmpty,
    });
  }
}
