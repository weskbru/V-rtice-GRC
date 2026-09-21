/**
 * T052/002-shared-grc-foundation, US2 — `TransitionActionUseCase`
 * (`transitionAction`, FR-015, FR-016, FR-028). `POST
 * /actions/{actionId}/transitions`. The ONLY place `Action`'s own lifecycle
 * legality table (`action.entity.ts#assertLegalActionTransition`) and
 * reopen-reason invariant (A2) are enforced — mirrors
 * `modules/risk/application/perform-transition.usecase.ts`'s shape for the
 * "declarative transition table, 422 for an illegal pair" reasoning, but
 * with a single static `action:edit` permission (checked by
 * `@RequirePermission` at the controller, per this contract's own
 * description — unlike risk's per-pair permission, every `Action`
 * transition answers to the same one).
 *
 * ## One semantic event per transition (FR-028)
 *
 * `action.entity.ts#actionTransitionEventName` names exactly one of
 * `action.started`/`action.completed`/`action.cancelled`/`action.reopened`
 * for every legal target status — never a generic `action.updated`.
 *
 * ## Field stamping (Invariant A1, FR-015, FR-016)
 *
 * - Entering `COMPLETED`: `completedAt`/`completedByUserId` stamped to now/
 *   the actor.
 * - Leaving `COMPLETED` (the only such edge is `COMPLETED -> OPEN`,
 *   reopening): `completedAt`/`completedByUserId` CLEARED back to `null` on
 *   the live row — Invariant A1 ("completedAt preenchido se e somente se
 *   status = COMPLETED") — while the PREVIOUS completion is preserved in
 *   the audit trail's `previousValues` on this very transition's own audit
 *   row, so "who completed it and when" is never lost, only no longer the
 *   live value (the adversarial test this task calls for explicitly).
 *   `reopenedAt`/`reopenedByUserId`/`reopenReason` are stamped at the same
 *   moment.
 * - Every other transition (`OPEN -> IN_PROGRESS`, `* -> CANCELLED`)
 *   touches none of the five completion/reopen columns.
 *
 * ## Scope is decided by the origin's CURRENT unit, not `Action.orgUnitId`
 *
 * Assurance fix (confirmed breach) — see
 * `assert-action-origin-in-scope.ts`'s header for the full reasoning. The
 * record is read unscoped, then `assertActionOriginInScope` re-checks the
 * origin's LIVE unit; the actual write is then issued against a
 * single-unit scope built from that SAME row's own currently-stored
 * `orgUnitId` (`unitScope([current.orgUnit.id])`) purely so it targets the
 * exact row already authorized above — it is never used as an access
 * decision, which is why it is safe even when that stored value is stale.
 * The audit entry's own `organizationalUnitId` uses the LIVE unit instead.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { NotFoundDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { unitScope } from '../../../shared/persistence/scope-filter';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import {
  actionTransitionEventName,
  assertLegalActionTransition,
  assertReopenReasonProvided,
} from '../domain/action.entity';
import { ActionReferenceDataPort } from '../domain/ports/action-reference-data.port';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import { assertActionOriginInScope } from './assert-action-origin-in-scope';

import type { ActionRecord, ActionTransitionChanges } from '../domain/ports/action-repository.port';
import type { ActionStatus } from '@prisma/client';

export interface TransitionActionInput {
  readonly actorUserId: string;
  readonly actionId: string;
  readonly to: ActionStatus;
  readonly reason?: string | undefined;
}

@Injectable()
export class TransitionActionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly actionRepository: ActionRepositoryPort,
    private readonly referenceData: ActionReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: TransitionActionInput): Promise<ActionRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const current = await this.actionRepository.findByIdUnscoped(input.actionId);
    if (!current) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
    }

    // Assurance fix — see this file's own header: gates the write on the
    // origin's LIVE unit rather than `current.orgUnit` (possibly stale).
    const origin = await assertActionOriginInScope(
      input.actorUserId,
      input.actionId,
      current.originType,
      current.originId,
    );

    assertLegalActionTransition(current.status, input.to);
    if (input.to === 'OPEN') {
      assertReopenReasonProvided(input.reason);
    }

    const now = new Date();
    const changes: ActionTransitionChanges = {
      status: input.to,
      completedAt: input.to === 'COMPLETED' ? now : null,
      completedByUserId: input.to === 'COMPLETED' ? input.actorUserId : null,
      reopenedAt: input.to === 'OPEN' ? now : null,
      reopenedByUserId: input.to === 'OPEN' ? input.actorUserId : null,
      reopenReason: input.to === 'OPEN' ? (input.reason ?? null) : null,
    };

    // Scoped to exactly this row's OWN currently-stored `orgUnitId` — never
    // an access decision (that already happened above), only how the write
    // targets the right row through the existing scoped repository method.
    const rowScope = unitScope([current.orgUnit.id]);

    return this.transactionRunner.run(async () => {
      const updated = await this.actionRepository.transition(rowScope, input.actionId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
      }

      await this.auditRecorder.record({
        action: actionTransitionEventName(input.to),
        entityType: AuditEntityType.ACTION,
        entityId: input.actionId,
        actorLabel: actor.fullName,
        previousValues: {
          status: current.status,
          completedAt: current.completedAt ?? null,
          completedByUserId: current.completedByUserId ?? null,
        },
        newValues: {
          status: updated.status,
          completedAt: updated.completedAt ?? null,
          completedByUserId: updated.completedByUserId ?? null,
          reopenedAt: updated.reopenedAt ?? null,
          reopenedByUserId: updated.reopenedByUserId ?? null,
          reopenReason: updated.reopenReason ?? null,
        },
        organizationalUnitId: origin.organizationalUnitId,
      });

      return updated;
    });
  }
}
