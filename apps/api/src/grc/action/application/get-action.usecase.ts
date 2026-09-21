/**
 * T051/002-shared-grc-foundation, US2 — `GetActionUseCase` (`getAction`,
 * FR-032). Reused verbatim by `ActionEvidenceSubjectAccessor` the same way
 * `GetEvidenceUseCase` is reused by `EvidenceParentRecordAccessor`.
 *
 * ## Scope is decided by the origin's CURRENT unit, not `Action.orgUnitId`
 *
 * Assurance fix (confirmed breach): the read used to be gated by
 * `ActionScopedRepository`'s own `orgUnitId` predicate — a creation-time
 * snapshot of the origin's unit that never moves when the origin is later
 * reassigned. `findByIdUnscoped` plus `assertActionOriginInScope` below
 * replace that with a LIVE re-check against the origin's current unit on
 * every call — see `assert-action-origin-in-scope.ts`'s own header for the
 * full reasoning (mirrors `EvidenceLinkVisibilityService`'s "never
 * persisted, always re-resolved" answer for a link's subject).
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { isActionOverdue, todayDateOnlyUtc } from '../../shared/domain/overdue.service';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import { ActionOriginLabelService } from './action-origin-label.service';
import { assertActionOriginInScope } from './assert-action-origin-in-scope';

import type { ActionRecord } from '../domain/ports/action-repository.port';

export interface GetActionInput {
  readonly actorUserId: string;
  readonly actionId: string;
}

/** `ActionRecord` plus the two read-time-derived fields
 * (contracts/grc-foundation.openapi.yaml's `Action` schema): `overdue`
 * (R-006, never stored) and `originLabel` (optional display field). */
export interface ActionWithDerived extends ActionRecord {
  readonly overdue: boolean;
  readonly originLabel: string | undefined;
}

@Injectable()
export class GetActionUseCase {
  constructor(
    private readonly actionRepository: ActionRepositoryPort,
    private readonly originLabelService: ActionOriginLabelService,
  ) {}

  async execute(input: GetActionInput): Promise<ActionWithDerived> {
    const record = await this.actionRepository.findByIdUnscoped(input.actionId);
    if (!record) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
    }

    // Assurance fix — see this file's own header: gates the read on the
    // origin's LIVE unit rather than `record.orgUnit` (possibly stale).
    await assertActionOriginInScope(
      input.actorUserId,
      input.actionId,
      record.originType,
      record.originId,
    );

    const originLabel = await this.originLabelService.resolveLabel(
      input.actorUserId,
      record.originType,
      record.originId,
    );

    return {
      ...record,
      overdue: isActionOverdue(record.dueOn, record.status, todayDateOnlyUtc()),
      originLabel,
    };
  }
}
