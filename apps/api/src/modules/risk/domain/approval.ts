/**
 * T157 — the domain-level segregation-of-duties rule (FR-029a, ADR-006):
 * "the deciding user must differ from the requesting user", enforced HERE
 * so it holds no matter which entry point calls `DecideApprovalUseCase` —
 * plus the `approvals_decided_by_requester_check` CHECK constraint added by
 * `20260905170100_risk_lifecycle_and_approvals_baseline` as a database
 * backstop to this same rule (two layers, deliberately — see this task's
 * report). Pure domain: no I/O, no framework import.
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

/**
 * Throws when `approverUserId === requesterUserId`. Called by
 * `DecideApprovalUseCase` before either an `APPROVED` or a `REJECTED`
 * decision is recorded — the check constraint this rule backstops applies
 * to any non-null `decidedByUserId`, regardless of the decision's outcome.
 */
export function assertApproverDiffersFromRequester(
  requesterUserId: string,
  approverUserId: string,
): void {
  if (approverUserId === requesterUserId) {
    throw new ValidationDomainError(USER_MESSAGES.risk.lifecycle.approvalSelfApproval, [
      { field: 'decision', message: USER_MESSAGES.risk.lifecycle.approvalSelfApproval },
    ]);
  }
}
