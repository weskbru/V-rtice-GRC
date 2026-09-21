/**
 * `ListActionAuditEventsUseCase`: the application-layer side of
 * `GET /actions/{actionId}/audit-events`
 * (`contracts/grc-foundation.openapi.yaml`'s `listActionAuditEvents`
 * operation). Mirrors `modules/risk/application/list-risk-audit-events
 * .usecase.ts` field-for-field — see that file's own header for the full
 * two-gate 404-vs-403 rationale this file does not repeat, and D-12
 * (`docs/local-environment.md`) for why the analogous controller could not
 * live under `core/audit/presentation/` either.
 *
 * ## Why this lives in `grc/action`, not `core/audit`
 *
 * Same reasoning as D-12, transplanted: telling "cannot see the action at
 * all" (404) apart from "can see it but lacks `audit:view`" (403) needs the
 * action's CURRENT visibility, which for `Action` is decided by
 * `ActionRepositoryPort.findByIdUnscoped` PLUS a live re-check of the
 * origin's CURRENT organizational unit (`assertActionOriginInScope` —
 * `Action.orgUnitId` itself is a stale creation-time snapshot, see that
 * function's own header). `core/audit` must never import `grc/**`
 * (ADR-011/ADR-016), so this decision can only be made from within
 * `grc/action` itself — which is also where it already lives for every
 * other `Action`-specific check (`GetActionUseCase`,
 * `TransitionActionUseCase`).
 *
 * ## Order of checks (mirrors the contract's own stated order)
 *
 * 1. `action:view`, checked directly via `PermissionResolverService` (never
 *    a guard) — missing it, OR the action not existing, OR the action's
 *    origin having fallen out of the actor's current scope, are all folded
 *    into the SAME `NotFoundDomainError` (byte-identical 404, ADR-009).
 * 2. `audit:view`, checked only once step 1 has succeeded — missing it is
 *    `ForbiddenDomainError` (403): the action's existence is already known
 *    to this caller, so refusing with 403 rather than 404 discloses
 *    nothing new (the same reasoning risk's own US7 AS4 states).
 *
 * ## Scope for the audit query itself
 *
 * `Action` has no child records the way `Risk` does (no assessments,
 * decisions, transitions-as-separate-rows) — every one of its own writes
 * (`action.created`/`action.updated`/`action.started`/`action.completed`/
 * `action.cancelled`/`action.reopened`) is recorded against the SAME
 * `AuditEntityType.ACTION` entity reference, `entityId = actionId`
 * (`create-action.usecase.ts`/`update-action.usecase.ts`/
 * `transition-action.usecase.ts`, all verified). So there is no
 * `collectEntityRefs` fan-out to build here — a single entity reference is
 * the complete and correct set. A write made through a DIFFERENT route
 * (e.g. the risk module's own `mirrorTransition`/`mirrorFieldUpdate` for a
 * `RISK_TREATMENT`-origin action edited via `PATCH
 * /risks/{riskId}/treatment-actions/{actionId}`) records its own
 * `RISK_TREATMENT_ACTION`-typed event instead, visible from the risk's own
 * `/risks/{riskId}/audit-events`, not this one — deliberately: this
 * endpoint is the shared Action's OWN trail, not a merge of every route
 * that can touch its origin.
 *
 * No transaction and no audit entry — reads are not audited (ADR-005).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditQueryService } from '../../../core/audit/application/audit-query.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { ForbiddenDomainError, NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import { assertActionOriginInScope } from './assert-action-origin-in-scope';

import type { AuditEventPage } from '../../../core/audit/domain/ports/audit-event-reader.port';

export interface ListActionAuditEventsInput {
  readonly actorUserId: string;
  readonly actionId: string;
  readonly action?: string | undefined;
  readonly actorUserIdFilter?: string | undefined;
  readonly occurredFrom?: Date | undefined;
  readonly occurredTo?: Date | undefined;
  readonly page: number;
  readonly pageSize: number;
}

@Injectable()
export class ListActionAuditEventsUseCase {
  constructor(
    private readonly actionRepository: ActionRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditQueryService: AuditQueryService,
  ) {}

  async execute(input: ListActionAuditEventsInput): Promise<AuditEventPage> {
    const canViewAction = await this.permissionResolver.hasPermission(
      input.actorUserId,
      'action:view',
    );
    const record = canViewAction
      ? await this.actionRepository.findByIdUnscoped(input.actionId)
      : undefined;
    if (!record) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
    }

    // Live re-check of the origin's CURRENT organizational unit — never
    // `record.orgUnit` (possibly stale). Throws `NotFoundDomainError`,
    // already re-keyed to `actionId`, when the origin no longer exists or
    // fell out of the actor's scope (see `assertActionOriginInScope`'s own
    // header).
    await assertActionOriginInScope(
      input.actorUserId,
      input.actionId,
      record.originType,
      record.originId,
    );

    const canViewAudit = await this.permissionResolver.hasPermission(
      input.actorUserId,
      'audit:view',
    );
    if (!canViewAudit) {
      throw new ForbiddenDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    return this.auditQueryService.query({
      entityRefs: [{ entityType: AuditEntityType.ACTION, entityId: input.actionId }],
      action: input.action,
      actorUserId: input.actorUserIdFilter,
      occurredFrom: input.occurredFrom,
      occurredTo: input.occurredTo,
      scope,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
