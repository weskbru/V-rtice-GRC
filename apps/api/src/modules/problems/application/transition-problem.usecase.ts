/**
 * 008-incidents-problems, US2 — `TransitionProblemUseCase`
 * (`POST /problems/{problemId}/transitions`, `transitionProblem`
 * operation, data-model.md §4, research.md D-5, D-7). Mirrors
 * `modules/controls/application/perform-control-transition.usecase.ts`'s
 * structure for the legality/permission/synchronous-precondition gate —
 * see that file's header for the "why permission is checked here, not by
 * a static `@RequirePermission`" reasoning this one does not repeat
 * (moot here in one respect: every `Problem` row names the SAME
 * `problem:transition` permission, unlike Controls' table).
 *
 * ## Closure (`RESOLVED -> CLOSED`) — the security-critical path
 *
 * This is the one transition `problem-lifecycle.ts`'s own table cannot
 * fully gate (its precondition evaluator is synchronous; P2/P3 both need
 * a database query) — checked HERE, after the table's own legality/
 * permission check passes, in this order:
 *
 * 1. `assertProblemHasCompletedCorrectiveAction` — **Invariant P2**: at
 *    least one `Action` with `originType: PROBLEM`, `originId:
 *    <this problem>`, `status: COMPLETED` must exist. Reverified on every
 *    attempt via `ProblemRepositoryPort
 *    .findCompletedOriginActionCompleters`, never cached (data-model.md
 *    §5).
 * 2. `assertCloserNotSameAsCompleter` — **Invariant P3, segregation of
 *    duties**: the closer must differ from EVERY completer that satisfied
 *    P2. Checked with the SAME list P2 already fetched — one query
 *    answers both invariants, never two round-trips that could disagree
 *    (mirrors `CloseFindingUseCase`'s identical F1/F2 shape).
 *
 * A P3 refusal is itself audited (`problem.close_denied`, `outcome:
 * DENIED`) in its own short-lived transaction — a signal someone
 * attempted a closure they are not entitled to make is worth its own
 * trail, distinct from "the caller lacked `problem:transition` entirely"
 * (already covered by `PermissionGuard`'s own `DENIED`-audit seam, which
 * never runs for this business-rule refusal). Mirrors
 * `CloseFindingUseCase#recordSegregationOfDutiesDenial` exactly.
 *
 * ## `rootCause` survives a reopen
 *
 * Reopening (`RESOLVED -> IN_ANALYSIS`) clears `resolvedAt`/
 * `resolvedByUserId` back to `null` (the previous resolution stays
 * legible in the audit trail's own `previousValues`), but deliberately
 * NOT `rootCause` — data-model.md names no requirement to erase a root
 * cause already identified, and doing so would silently discard real
 * analysis work the next `RESOLVED` transition would otherwise have to
 * reproduce from scratch. Mirrors `FindingRepositoryPort.reopen`'s own
 * choice of exactly which columns a reopen clears versus leaves alone.
 *
 * ## Semantic audit actions — never a generic `problem.transitioned`
 *
 * Keyed by the SPECIFIC `(from, to)` pair, not merely the target status:
 * `OPEN -> IN_ANALYSIS` (`problem.analysis_started`) and
 * `RESOLVED -> IN_ANALYSIS` (`problem.reopened`) share a target status but
 * are different business facts — starting analysis is not reopening a
 * resolved problem — so they get different action names, unlike Controls'
 * `RETIRED`, which is genuinely the same fact regardless of its three
 * possible sources.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  ForbiddenDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { ProblemReferenceDataPort } from '../domain/ports/problem-reference-data.port';
import { ProblemRepositoryPort } from '../domain/ports/problem-repository.port';
import {
  evaluateProblemPreconditions,
  findProblemLifecycleTransition,
} from '../domain/problem-lifecycle';
import {
  assertCloserNotSameAsCompleter,
  assertLegalProblemTransition,
  assertProblemHasCompletedCorrectiveAction,
  assertRootCauseProvided,
  assertCancellationReasonProvided,
  assertReopenReasonProvided,
} from '../domain/problem.entity';

import type {
  ApplyProblemTransitionChanges,
  ProblemRecord,
} from '../domain/ports/problem-repository.port';
import type { ProblemStatus } from '@prisma/client';

const AUDIT_ACTION_BY_TRANSITION: Readonly<Record<string, string>> = {
  'OPEN->IN_ANALYSIS': 'problem.analysis_started',
  'OPEN->CANCELLED': 'problem.cancelled',
  'IN_ANALYSIS->RESOLVED': 'problem.resolved',
  'IN_ANALYSIS->CANCELLED': 'problem.cancelled',
  'RESOLVED->CLOSED': 'problem.closed',
  'RESOLVED->IN_ANALYSIS': 'problem.reopened',
};

export interface TransitionProblemInput {
  readonly actorUserId: string;
  readonly problemId: string;
  readonly toStatus: ProblemStatus;
  readonly rootCause?: string | undefined;
  readonly cancellationReason?: string | undefined;
  readonly reopenReason?: string | undefined;
}

@Injectable()
export class TransitionProblemUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: TransitionProblemInput): Promise<ProblemRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.problemRepository.findById(scope, input.problemId);
    if (!current) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, input.problemId);
    }

    // Throws (naming the field) when `(from, to)` is not in
    // `problem-lifecycle.ts`'s own table — checked first, so the
    // subsequent `findProblemLifecycleTransition` lookup below is
    // guaranteed to succeed.
    assertLegalProblemTransition(current.status, input.toStatus);
    const rule = findProblemLifecycleTransition(current.status, input.toStatus)!;

    const allowed = await this.permissionResolver.hasPermission(
      input.actorUserId,
      rule.requiredPermission,
    );
    if (!allowed) {
      throw new ForbiddenDomainError();
    }

    const preconditionResults = evaluateProblemPreconditions(rule.preconditions, {
      rootCause: input.rootCause,
      cancellationReason: input.cancellationReason,
      reopenReason: input.reopenReason,
    });
    const unmet = preconditionResults.filter((result) => !result.met);
    if (unmet.length > 0) {
      // Re-throw via the domain assertion that owns this precondition's
      // exact message/field, rather than constructing a fresh
      // `ValidationDomainError` here — one wording per invariant, defined
      // once in `problem.entity.ts`.
      if (unmet.some((r) => r.id === 'HAS_ROOT_CAUSE')) assertRootCauseProvided(input.rootCause);
      if (unmet.some((r) => r.id === 'HAS_CANCELLATION_REASON'))
        assertCancellationReasonProvided(input.cancellationReason);
      if (unmet.some((r) => r.id === 'HAS_REOPEN_REASON'))
        assertReopenReasonProvided(input.reopenReason);
    }

    // Invariant P2/P3 — CLOSED only (this file's own header).
    let completerUserIds: readonly string[] = [];
    if (input.toStatus === 'CLOSED') {
      completerUserIds = await this.problemRepository.findCompletedOriginActionCompleters(
        input.problemId,
      );
      assertProblemHasCompletedCorrectiveAction(completerUserIds);
      try {
        assertCloserNotSameAsCompleter(input.actorUserId, completerUserIds);
      } catch (error) {
        if (error instanceof ForbiddenDomainError) {
          await this.recordSegregationOfDutiesDenial(current, actor.fullName);
        }
        throw error;
      }
    }

    const referenceDate = new Date();
    const changes = this.buildTransitionChanges(input, referenceDate);

    return this.transactionRunner.run(async () => {
      const updated = await this.problemRepository.applyTransition(scope, input.problemId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, input.problemId);
      }

      const transitionKey = `${current.status}->${input.toStatus}`;
      await this.auditRecorder.record({
        action: AUDIT_ACTION_BY_TRANSITION[transitionKey] ?? 'problem.transitioned',
        entityType: AuditEntityType.PROBLEM,
        entityId: input.problemId,
        actorLabel: actor.fullName,
        previousValues: { status: current.status },
        newValues: {
          status: input.toStatus,
          rootCause: changes.rootCause,
          cancellationReason: changes.cancellationReason,
          reopenReason: input.reopenReason ?? undefined,
        },
        organizationalUnitId: current.orgUnit.id,
      });

      return updated;
    });
  }

  private buildTransitionChanges(
    input: TransitionProblemInput,
    referenceDate: Date,
  ): ApplyProblemTransitionChanges {
    switch (input.toStatus) {
      case 'RESOLVED':
        // Non-null: `assertRootCauseProvided` already ran in `execute`
        // above (Invariant P1) — a request reaching here always carries a
        // non-empty `rootCause`.
        return {
          status: 'RESOLVED',
          rootCause: input.rootCause!,
          resolvedAt: referenceDate,
          resolvedByUserId: input.actorUserId,
        };
      case 'CLOSED':
        return {
          status: 'CLOSED',
          closedAt: referenceDate,
          closedByUserId: input.actorUserId,
        };
      case 'CANCELLED':
        // Non-null: `assertCancellationReasonProvided` already ran in
        // `execute` above.
        return {
          status: 'CANCELLED',
          cancellationReason: input.cancellationReason!,
          cancelledAt: referenceDate,
          cancelledByUserId: input.actorUserId,
        };
      case 'IN_ANALYSIS':
        // Both `OPEN -> IN_ANALYSIS` (start) and `RESOLVED -> IN_ANALYSIS`
        // (reopen) land here — only the reopen edge has anything to
        // clear, and clearing columns that are already `null` (the start
        // case) is a harmless no-op, never a second branch to keep in
        // sync.
        return {
          status: 'IN_ANALYSIS',
          resolvedAt: null,
          resolvedByUserId: null,
        };
      default:
        return { status: input.toStatus };
    }
  }

  /** See this file's own header, "A P3 refusal is itself audited" — a
   * short-lived, audit-only transaction, since there is no ambient
   * business-write transaction to join at the point P3 refuses. Mirrors
   * `CloseFindingUseCase#recordSegregationOfDutiesDenial` exactly. */
  private async recordSegregationOfDutiesDenial(
    problem: ProblemRecord,
    actorLabel: string,
  ): Promise<void> {
    await this.transactionRunner.run(async () => {
      await this.auditRecorder.record({
        action: 'problem.close_denied',
        entityType: AuditEntityType.PROBLEM,
        entityId: problem.id,
        actorLabel,
        organizationalUnitId: problem.orgUnit.id,
        outcome: 'DENIED',
      });
    });
  }
}
