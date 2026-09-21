/**
 * `ActionAuditController`: `GET /actions/{actionId}/audit-events` per
 * `contracts/grc-foundation.openapi.yaml`'s `listActionAuditEvents`
 * operation. Mirrors `modules/risk/presentation/audit.controller.ts`'s
 * `AuditController` shape exactly — see that file's header and D-12
 * (`docs/local-environment.md`) for the full "why not `core/audit`"
 * reasoning this file's own placement in `grc/action/presentation/`
 * follows identically (this capability owns `Action`'s current existence
 * and organizational scope, `core/audit` must never import `grc/**`).
 *
 * A SEPARATE controller from `ActionController` (not a fourth method on
 * it) purely so the generated `operationId`
 * (`${ControllerName}_${methodName}`, `apps/api/src/infrastructure/openapi/
 * document.ts`'s default Nest Swagger factory) reads
 * `ActionAuditController_list` — distinguishable from `ActionController`'s
 * own `_list` (`listActions`) in `apps/api/openapi.json` and in
 * `test/contract/information-disclosure.spec.ts`'s sweep, the same way
 * `modules/risk`'s `AuditController` is its own class rather than a method
 * on `RiskController`.
 */
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { NoPermissionRequired } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { createPageResponse } from '../../../shared/pagination';
import { ListActionAuditEventsUseCase } from '../application/list-action-audit-events.usecase';

import { toAuditEventResponse, type AuditEventResponse } from './dto/audit-event-response.mapper';
import { ListActionAuditEventsQueryDto } from './dto/list-action-audit-events-query.dto';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

export interface ActionAuditEventsPageResponse {
  readonly data: readonly AuditEventResponse[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

@Controller('actions/:actionId')
export class ActionAuditController {
  constructor(private readonly listActionAuditEventsUseCase: ListActionAuditEventsUseCase) {}

  /**
   * `@NoPermissionRequired()`, not `@RequirePermission` — this route's
   * authorization is `action:view` (404 if absent/out of scope) AND
   * `audit:view` (403 if absent), a shape `PermissionGuard`'s single
   * `identifier` + single refusal code cannot express. Both are checked, in
   * the contract's own stated order, inside `ListActionAuditEventsUseCase`
   * — see this file's header and that use case's header for the full
   * reasoning. The route still requires a valid session
   * (`@NoPermissionRequired()` never bypasses `SessionGuard`).
   */
  @NoPermissionRequired()
  @Get('audit-events')
  async list(
    @CurrentSession() session: ValidatedSession,
    @Param('actionId', new ParseUUIDPipe()) actionId: string,
    @Query() query: ListActionAuditEventsQueryDto,
  ): Promise<ActionAuditEventsPageResponse> {
    const { items, total } = await this.listActionAuditEventsUseCase.execute({
      actorUserId: session.userId,
      actionId,
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
