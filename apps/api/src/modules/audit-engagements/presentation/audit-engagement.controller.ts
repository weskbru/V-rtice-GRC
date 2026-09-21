/**
 * T040/005-audit-findings, User Story 1 — `AuditEngagementController`: the
 * record operations of `contracts/audit.openapi.yaml` (`listAuditEngagements`,
 * `createAuditEngagement`, `getAuditEngagement`, `updateAuditEngagement` —
 * operations 1-4 of 11). Mirrors `modules/controls/presentation/control.controller.ts`'s
 * structure exactly — see that file's header for the `formatETag`/
 * `parseIfMatchHeader`/`assertUpdateBodyNotEmpty` reasoning this one does
 * not repeat. Re-declared locally rather than imported from
 * `modules/controls` (ADR-011/SC-008: no business module imports another).
 *
 * Every route is gated by an `audit-engagement:*` permission — never
 * `audit:*`, which already means something else (FR-019, this module's own
 * `audit-engagement-permissions.ts` header).
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
  Query,
  Req,
  Res,
} from '@nestjs/common';

import { RequirePermission } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { parseIsoDate } from '../../../grc/shared/domain/iso-date';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { CreateAuditEngagementUseCase } from '../application/create-audit-engagement.usecase';
import { GetAuditEngagementUseCase } from '../application/get-audit-engagement.usecase';
import { ListAuditEngagementUseCase } from '../application/list-audit-engagement.usecase';
import { UpdateAuditEngagementUseCase } from '../application/update-audit-engagement.usecase';

import {
  toAuditEngagementResponse,
  type AuditEngagementResponse,
} from './dto/audit-engagement-response.mapper';
import { CreateAuditEngagementRequestDto } from './dto/create-audit-engagement-request.dto';
import { ListAuditEngagementsQueryDto } from './dto/list-audit-engagements-query.dto';
import { UpdateAuditEngagementRequestDto } from './dto/update-audit-engagement-request.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';
import type { Request, Response } from 'express';

export interface AuditEngagementPageResponse {
  readonly data: readonly AuditEngagementResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('audits')
export class AuditEngagementController {
  constructor(
    private readonly createAuditEngagementUseCase: CreateAuditEngagementUseCase,
    private readonly getAuditEngagementUseCase: GetAuditEngagementUseCase,
    private readonly listAuditEngagementUseCase: ListAuditEngagementUseCase,
    private readonly updateAuditEngagementUseCase: UpdateAuditEngagementUseCase,
  ) {}

  /**
   * `listAuditEngagements`. Declared BEFORE `findById`'s `:auditId` route
   * in this file for the same reason `ControlController.list` documents:
   * Nest dispatches `/audits` and `/audits/:auditId` unambiguously
   * regardless of declaration order.
   *
   * `status`/`orgUnitId`/`leadAuditorUserId` are each a single query value
   * in the contract (`ListAuditEngagementsQueryDto`'s own header) — wrapped
   * into a one-element array here for `ListAuditEngagementUseCase`, whose
   * own filter shape accepts an array.
   */
  @RequirePermission('audit-engagement:view')
  @Get()
  async list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: ListAuditEngagementsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementPageResponse> {
    const result = await this.listAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      page: query.page,
      pageSize: query.pageSize,
      status: query.status ? [query.status] : undefined,
      orgUnitId: query.orgUnitId ? [query.orgUnitId] : undefined,
      leadAuditorUserId: query.leadAuditorUserId ? [query.leadAuditorUserId] : undefined,
      sortField: query.sort,
      sortDirection: query.direction,
    });

    response.set('Cache-Control', 'no-store');

    return {
      data: result.items.map(toAuditEngagementResponse),
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @RequirePermission('audit-engagement:create')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentSession() session: ValidatedSession,
    @Body() body: CreateAuditEngagementRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementResponse> {
    const record = await this.createAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      objective: body.objective,
      periodStart: parseIsoDate(body.periodStart),
      periodEnd: parseIsoDate(body.periodEnd),
      orgUnitId: body.orgUnitId,
      leadAuditorUserId: body.leadAuditorUserId,
    });

    response.set('Location', `${request.originalUrl.replace(/\/$/, '')}/${record.id}`);
    response.set('ETag', formatETag(record.version));

    return toAuditEngagementResponse(record);
  }

  @RequirePermission('audit-engagement:view')
  @Get(':auditId')
  async findById(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementResponse> {
    const record = await this.getAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
    });

    response.set('ETag', formatETag(record.version));
    response.set('Cache-Control', 'no-store');

    return toAuditEngagementResponse(record);
  }

  @RequirePermission('audit-engagement:edit')
  @Patch(':auditId')
  async update(
    @CurrentSession() session: ValidatedSession,
    @Param('auditId', new ParseUUIDPipe()) auditId: string,
    @Headers('if-match') ifMatchHeader: string | undefined,
    @Body() body: UpdateAuditEngagementRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuditEngagementResponse> {
    const expectedVersion = parseIfMatchHeader(ifMatchHeader);
    assertUpdateBodyNotEmpty(body);

    const record = await this.updateAuditEngagementUseCase.execute({
      actorUserId: session.userId,
      auditEngagementId: auditId,
      expectedVersion,
      objective: body.objective,
      periodStart: body.periodStart ? parseIsoDate(body.periodStart) : undefined,
      periodEnd: body.periodEnd ? parseIsoDate(body.periodEnd) : undefined,
      orgUnitId: body.orgUnitId,
      leadAuditorUserId: body.leadAuditorUserId,
    });

    response.set('ETag', formatETag(record.version));

    return toAuditEngagementResponse(record);
  }
}

/** Exported for reuse by `audit-engagement-scope.controller.ts`/
 * `audit-engagement-lifecycle.controller.ts` — every engagement-mutating
 * endpoint formats/parses `ETag`/`If-Match` identically (ADR-013), so this
 * is the one place either does it, mirroring `control.controller.ts`'s own
 * `formatETag`. */
export function formatETag(version: number): string {
  return `"${String(version)}"`;
}

/** Exported for reuse — see `formatETag`'s doc comment above, and
 * `control.controller.ts`'s own `parseIfMatchHeader` for the full
 * `400`/`409` split this mirrors. */
export function parseIfMatchHeader(headerValue: string | undefined): number {
  if (headerValue === undefined || headerValue.trim().length === 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.auditEngagements.ifMatchRequired,
    });
  }

  const unquoted = headerValue.trim().replace(/^"|"$/g, '');
  const version = Number(unquoted);

  if (!Number.isInteger(version) || version < 0) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.auditEngagements.ifMatchInvalid,
    });
  }

  return version;
}

/** `UpdateAuditEngagementRequest`'s `minProperties: 1` — see
 * `UpdateAuditEngagementRequestDto`'s header and
 * `ControlController.assertUpdateBodyNotEmpty`'s own doc comment for why
 * this is a controller-level check (the `plainToInstance` own-property
 * caveat) with no dedicated validator class. */
function assertUpdateBodyNotEmpty(body: UpdateAuditEngagementRequestDto): void {
  if (!Object.values(body).some((value) => value !== undefined)) {
    throw new BadRequestException({
      title: USER_MESSAGES.problemTitle.badRequest,
      detail: USER_MESSAGES.auditEngagements.updateRequestEmpty,
    });
  }
}
