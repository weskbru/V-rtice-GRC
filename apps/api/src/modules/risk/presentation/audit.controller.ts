/**
 * T168/US7 — `AuditController`: `GET /risks/{riskId}/audit-events` per
 * `contracts/risks.openapi.yaml`'s `listRiskAuditEvents` operation.
 *
 * ## Why this file lives in `modules/risk/presentation/`, not literally at
 * `apps/api/src/core/audit/presentation/audit.controller.ts` as the task
 * sheet named
 *
 * This is a deliberate, reported deviation (see the implementation
 * report), not an oversight. The contract's own 404-vs-403 rule needs the
 * risk's CURRENT existence and organizational scope
 * (`RiskRepositoryPort.findById`) — a `core/audit` controller cannot reach
 * that without importing `modules/risk`, which
 * `apps/api/eslint.config.mjs`'s boundary lint mechanically forbids
 * (`core/** never imports modules/**`, ADR-011) for good reason: it is
 * what keeps a future module (Problems, Incidents, ...) addable without
 * editing `core/**`. A design using `audit_event`'s OWN rows as a
 * visibility proxy (e.g. "any row for this risk within scope") was
 * considered and rejected — a risk that has been REASSIGNED to a
 * different organizational unit would still have OLDER audit rows
 * carrying the unit it used to belong to, which could make an
 * out-of-scope risk look visible (or a now-in-scope risk look invisible)
 * depending on which unit's rows happen to still be there. Only the
 * `risk` table's CURRENT `orgUnitId` answers "is this risk in scope
 * right now" correctly, and that is `modules/risk`'s own data.
 *
 * The part of T168 that genuinely IS core, reusable audit-query capability
 * — permission-and-scope-filtered querying of `audit_event`, generic over
 * entity type — is `core/audit/application/audit-query.service.ts`
 * (`AuditQueryService`) and its supporting port/reader, which THIS
 * controller (a `modules/risk` composition, allowed to depend on
 * `core/**`) consumes. See `ListRiskAuditEventsUseCase`'s header for the
 * full reasoning and `AuditQueryService`'s header for its own side of it.
 */
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { NoPermissionRequired } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { createPageResponse } from '../../../shared/pagination';
import { ListRiskAuditEventsUseCase } from '../application/list-risk-audit-events.usecase';

import { toAuditEventResponse, type AuditEventResponse } from './dto/audit-event-response.mapper';
import { ListRiskAuditEventsQueryDto } from './dto/list-risk-audit-events-query.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface RiskAuditEventsPageResponse {
  readonly data: readonly AuditEventResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('risks/:riskId')
export class AuditController {
  constructor(private readonly listRiskAuditEventsUseCase: ListRiskAuditEventsUseCase) {}

  /**
   * `@NoPermissionRequired()`, not `@RequirePermission` — this route's
   * authorization is `risk:view` (404 if absent/out of scope) AND
   * `audit:view` (403 if absent), a shape `PermissionGuard`'s single
   * `identifier` + single refusal code cannot express. Both are checked,
   * in the contract's own stated order, inside `ListRiskAuditEventsUseCase`
   * — see this file's header and that use case's header for the full
   * reasoning. The route still requires a valid session
   * (`@NoPermissionRequired()` never bypasses `SessionGuard`).
   */
  @NoPermissionRequired()
  @Get('audit-events')
  async list(
    @CurrentSession() session: ValidatedSession,
    @Param('riskId', new ParseUUIDPipe()) riskId: string,
    @Query() query: ListRiskAuditEventsQueryDto,
  ): Promise<RiskAuditEventsPageResponse> {
    const { items, total } = await this.listRiskAuditEventsUseCase.execute({
      actorUserId: session.userId,
      riskId,
      action: query.action,
      actorUserIdFilter: query.actorUserId,
      occurredFrom: query.occurredFrom ? new Date(query.occurredFrom) : undefined,
      occurredTo: query.occurredTo ? new Date(query.occurredTo) : undefined,
      page: query.page,
      pageSize: query.pageSize,
    });

    const page = createPageResponse(items, { page: query.page, pageSize: query.pageSize }, total);

    return {
      data: page.items.map(toAuditEventResponse),
      meta: {
        page: page.page,
        pageSize: page.pageSize,
        total: page.total,
        totalPages: page.totalPages,
      },
    };
  }
}
