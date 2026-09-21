/**
 * 008-incidents-problems, US1 — `TransitionIncidentUseCase`
 * (`transitionIncident`, `POST /incidents/{incidentId}/transitions`,
 * contracts/incidents.openapi.yaml, data-model.md D-4). The ONLY place
 * `incident.entity.ts`'s transition table and per-status invariants
 * (I1/I2, reopen reason) are enforced — mirrors
 * `grc/action/application/transition-action.usecase.ts`'s shape for the
 * "declarative transition table, 422 for an illegal pair" reasoning.
 *
 * ## Live scope, no separate origin check
 *
 * Unlike `Action` (whose lifecycle authorization is decided by a SEPARATE
 * origin record's live unit, since an action's own `orgUnitId` is a
 * convenience mirror that can go stale — see that use case's header),
 * `Incident` IS the record: `orgUnitId` is its own column, never assigned
 * by any other domain, and `UpdateIncidentRequest` has no field that ever
 * moves it. Reading it fresh via a SCOPED `findById` immediately before
 * acting on it — the same read `GetIncidentUseCase`/`UpdateIncidentUseCase`
 * already perform — IS the live-scope check: there is no join, no cached
 * value, nothing to go stale between the read and the write below.
 *
 * ## One semantic event per (from, to) pair
 *
 * `incident.entity.ts#incidentTransitionEventName` names exactly one of
 * `incident.started`/`incident.resolved`/`incident.cancelled`/
 * `incident.closed`/`incident.reopened` — never a generic
 * `incident.updated` (coordinator, 2026-09-11).
 *
 * ## Field stamping — nothing that carries history is overwritten
 *
 * Every one of the 8 resolution/closure/cancellation columns is computed
 * from a "carry the CURRENT value forward" baseline, then overridden only
 * for the columns THIS transition legitimately touches:
 *
 * - `RESOLVED`: stamps `resolutionSummary`/`resolvedAt`/`resolvedByUserId`.
 * - `CLOSED`: stamps `closedAt`/`closedByUserId` — the resolution fields
 *   set by the PRIOR `RESOLVED` transition are carried forward unchanged
 *   (never re-derived, never cleared), so "who resolved it and when"
 *   survives closure.
 * - `CANCELLED`: stamps `cancellationReason`/`cancelledAt`/
 *   `cancelledByUserId`. Only reachable from `OPEN`/`IN_PROGRESS`, so the
 *   resolution/closure columns are already `null` here.
 * - `IN_PROGRESS` from `RESOLVED` (reopen): CLEARS `resolutionSummary`/
 *   `resolvedAt`/`resolvedByUserId` back to `null` on the LIVE row — the
 *   prior values are preserved only in THIS transition's own audit
 *   `previousValues`, never lost, only no longer the live value (the same
 *   adversarial shape `TransitionActionUseCase`'s own header documents).
 *   `reopenReason` reaches only the audit event's `newValues` — it is
 *   never a persisted column on `Incident` (data-model.md §1,
 *   `incident.entity.ts#assertReopenReasonProvided`'s own header).
 * - `IN_PROGRESS` from `OPEN` (start): touches none of the 8 columns —
 *   all are already `null`.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import {
  assertCancellationReasonProvided,
  assertLegalIncidentTransition,
  assertReopenReasonProvided,
  assertResolutionSummaryProvided,
  incidentTransitionEventName,
} from '../domain/incident.entity';
import { IncidentReferenceDataPort } from '../domain/ports/incident-reference-data.port';
import { IncidentRepositoryPort } from '../domain/ports/incident-repository.port';

import type {
  IncidentRecord,
  IncidentTransitionChanges,
} from '../domain/ports/incident-repository.port';
import type { IncidentStatus } from '@prisma/client';

export interface TransitionIncidentInput {
  readonly actorUserId: string;
  readonly incidentId: string;
  readonly toStatus: IncidentStatus;
  readonly resolutionSummary?: string | undefined;
  readonly cancellationReason?: string | undefined;
  readonly reopenReason?: string | undefined;
}

@Injectable()
export class TransitionIncidentUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly incidentRepository: IncidentRepositoryPort,
    private readonly referenceData: IncidentReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: TransitionIncidentInput): Promise<IncidentRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const current = await this.incidentRepository.findById(scope, input.incidentId);
    if (!current) {
      // F-38: recorded server-side, via `assertExistingRecordAccessible`,
      // whenever the incident actually exists outside `scope`.
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.INCIDENT,
          entityId: input.incidentId,
          entityLabel: USER_MESSAGES.incidents.entityLabel,
        },
        () => this.incidentRepository.findOrgUnitIdUnscoped(input.incidentId),
      );
    }

    assertLegalIncidentTransition(current.status, input.toStatus);

    const isReopen = input.toStatus === 'IN_PROGRESS' && current.status === 'RESOLVED';
    if (input.toStatus === 'RESOLVED') {
      assertResolutionSummaryProvided(input.resolutionSummary);
    }
    if (input.toStatus === 'CANCELLED') {
      assertCancellationReasonProvided(input.cancellationReason);
    }
    if (isReopen) {
      assertReopenReasonProvided(input.reopenReason);
    }

    const now = new Date();

    // Baseline — carry every stamp column forward unchanged; only the
    // branches below may override one.
    const changes: {
      -readonly [K in keyof IncidentTransitionChanges]: IncidentTransitionChanges[K];
    } = {
      status: input.toStatus,
      resolutionSummary: current.resolutionSummary ?? null,
      resolvedAt: current.resolvedAt ?? null,
      resolvedByUserId: current.resolvedBy?.id ?? null,
      closedAt: current.closedAt ?? null,
      closedByUserId: current.closedBy?.id ?? null,
      cancellationReason: current.cancellationReason ?? null,
      cancelledAt: current.cancelledAt ?? null,
      cancelledByUserId: current.cancelledBy?.id ?? null,
    };

    const previousValues: Record<string, unknown> = { status: current.status };
    const newValues: Record<string, unknown> = { status: input.toStatus };

    if (input.toStatus === 'RESOLVED') {
      changes.resolutionSummary = input.resolutionSummary!;
      changes.resolvedAt = now;
      changes.resolvedByUserId = input.actorUserId;
      newValues.resolutionSummary = changes.resolutionSummary;
      newValues.resolvedAt = changes.resolvedAt;
      newValues.resolvedByUserId = changes.resolvedByUserId;
    } else if (input.toStatus === 'CLOSED') {
      changes.closedAt = now;
      changes.closedByUserId = input.actorUserId;
      newValues.closedAt = changes.closedAt;
      newValues.closedByUserId = changes.closedByUserId;
    } else if (input.toStatus === 'CANCELLED') {
      changes.cancellationReason = input.cancellationReason!;
      changes.cancelledAt = now;
      changes.cancelledByUserId = input.actorUserId;
      newValues.cancellationReason = changes.cancellationReason;
      newValues.cancelledAt = changes.cancelledAt;
      newValues.cancelledByUserId = changes.cancelledByUserId;
    } else if (isReopen) {
      // Preserve the prior resolution on the audit trail before clearing
      // the live columns — never simply lost.
      previousValues.resolutionSummary = current.resolutionSummary ?? null;
      previousValues.resolvedAt = current.resolvedAt ?? null;
      previousValues.resolvedByUserId = current.resolvedBy?.id ?? null;
      changes.resolutionSummary = null;
      changes.resolvedAt = null;
      changes.resolvedByUserId = null;
      newValues.resolutionSummary = null;
      newValues.resolvedAt = null;
      newValues.resolvedByUserId = null;
      // Never a persisted column — reaches only this audit event.
      newValues.reopenReason = input.reopenReason;
    }

    return this.transactionRunner.run(async () => {
      const updated = await this.incidentRepository.transition(scope, input.incidentId, changes);
      if (!updated) {
        // Between the read above and this write, the record stopped
        // existing in scope — refused the same way as any other genuine
        // not-found, without a second F-38 audit (the first already ran).
        return this.scopeEnforcer.assertExistingRecordAccessible(
          {
            scope,
            actorUserId: input.actorUserId,
            entityType: AuditEntityType.INCIDENT,
            entityId: input.incidentId,
            entityLabel: USER_MESSAGES.incidents.entityLabel,
          },
          () => this.incidentRepository.findOrgUnitIdUnscoped(input.incidentId),
        );
      }

      await this.auditRecorder.record({
        action: incidentTransitionEventName(current.status, input.toStatus),
        entityType: AuditEntityType.INCIDENT,
        entityId: input.incidentId,
        actorLabel: actor.fullName,
        previousValues,
        newValues,
        organizationalUnitId: current.orgUnit.id,
      });

      return updated;
    });
  }
}
