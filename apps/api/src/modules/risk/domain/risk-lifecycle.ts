/**
 * T154 — the declarative risk lifecycle transition table (ADR-006, FR-079 to
 * FR-081), transcribed row-for-row from `research.md`'s ADR-006 table. Pure
 * domain: no I/O, no framework import (`eslint-plugin-boundaries` enforces
 * this at `module-domain`).
 *
 * This table IS the specification (FR-080/FR-081): "any (from, to) pair
 * absent from this table is refused ... adding an approval gate later is a
 * data change, not a restructuring" (ADR-006). `findLifecycleTransition`
 * and `listLifecycleTransitionsFrom` are the ONLY two ways any code in this
 * module ever asks "is this transition legal" — `PerformTransitionUseCase`
 * (T156), `RequestApprovalUseCase` (T157) and `GetRiskLifecycleUseCase`
 * (T159) all resolve their answer through this same table, so the register,
 * the transition endpoint and the lifecycle preview endpoint can never
 * disagree about what is legal (the same "derived values computed in
 * exactly one place" discipline `RiskScoringService` already established
 * for scoring — `docs/architecture.md`'s own stated rule).
 *
 * ## Requesting vs deciding are different permissions (FR-029, FR-029a)
 *
 * Every row whose `requiresApproval` is `true` names `risk:transition` as
 * `requiredPermission` — that is the permission to REQUEST the gated
 * transition (`POST /risks/{riskId}/approvals`). Deciding it (`POST
 * .../approvals/{approvalId}/decision`) always requires `risk:approve`
 * instead, enforced directly by `DecideApprovalUseCase`/its controller
 * route, never read from this table — collapsing the two onto one
 * permission would hollow out FR-029a exactly as ADR-006 warns.
 */
import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { RiskStatus } from '@prisma/client';

/** Identifiers for the precondition evaluators in
 * `domain/transition-preconditions.ts` — kept as a closed union here (the
 * table) so a transition row can only ever reference a precondition that
 * evaluator module actually implements; `tsc` fails otherwise. */
export type TransitionPreconditionId =
  | 'DRAFT_FIELDS_COMPLETE'
  | 'HAS_ASSESSMENT'
  | 'HAS_TREATMENT_DECISION'
  | 'REASSESSED_DURING_REVIEW';

export interface LifecycleTransitionRule {
  readonly from: RiskStatus;
  readonly to: RiskStatus;
  /** The permission required to REQUEST this transition — see this file's
   * header for why "request" and "decide" are always distinct for a gated
   * row. */
  readonly requiredPermission: PermissionIdentifier;
  /** `true` for the two transitions FR-029 gates: entering `ACCEPTED` and
   * entering `CLOSED`. A gated row is refused with 422 at `POST
   * /risks/{riskId}/transitions` (FR-081) and MUST instead be requested via
   * `POST /risks/{riskId}/approvals`. */
  readonly requiresApproval: boolean;
  /** Empty = no precondition beyond the state/permission check itself. */
  readonly preconditions: readonly TransitionPreconditionId[];
}

/**
 * ADR-006's transition table, one row per legal (from, to) pair — every
 * fan-out row (e.g. "ASSESSED / UNDER_TREATMENT -> UNDER_REVIEW") is
 * expanded into its own row here rather than a compressed "from: []" list,
 * so `findLifecycleTransition` stays a trivial two-field lookup with no
 * membership-testing logic of its own to get wrong.
 */
export const RISK_LIFECYCLE_TRANSITIONS: readonly LifecycleTransitionRule[] = [
  // DRAFT -> IDENTIFIED — risk:edit, required fields complete, no approval.
  {
    from: 'DRAFT',
    to: 'IDENTIFIED',
    requiredPermission: 'risk:edit',
    requiresApproval: false,
    preconditions: ['DRAFT_FIELDS_COMPLETE'],
  },
  // IDENTIFIED -> ASSESSED — risk:assess, >=1 assessment exists, no approval.
  {
    from: 'IDENTIFIED',
    to: 'ASSESSED',
    requiredPermission: 'risk:assess',
    requiresApproval: false,
    preconditions: ['HAS_ASSESSMENT'],
  },
  // ASSESSED -> UNDER_TREATMENT — risk:treat, treatment decision exists, no approval.
  {
    from: 'ASSESSED',
    to: 'UNDER_TREATMENT',
    requiredPermission: 'risk:treat',
    requiresApproval: false,
    preconditions: ['HAS_TREATMENT_DECISION'],
  },
  // ASSESSED / UNDER_TREATMENT -> UNDER_REVIEW — risk:transition, no precondition, no approval.
  {
    from: 'ASSESSED',
    to: 'UNDER_REVIEW',
    requiredPermission: 'risk:transition',
    requiresApproval: false,
    preconditions: [],
  },
  {
    from: 'UNDER_TREATMENT',
    to: 'UNDER_REVIEW',
    requiredPermission: 'risk:transition',
    requiresApproval: false,
    preconditions: [],
  },
  // ASSESSED / UNDER_TREATMENT / UNDER_REVIEW -> ACCEPTED — risk:transition
  // to REQUEST, >=1 assessment exists, APPROVAL REQUIRED (risk:approve to decide).
  {
    from: 'ASSESSED',
    to: 'ACCEPTED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
    preconditions: ['HAS_ASSESSMENT'],
  },
  {
    from: 'UNDER_TREATMENT',
    to: 'ACCEPTED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
    preconditions: ['HAS_ASSESSMENT'],
  },
  {
    from: 'UNDER_REVIEW',
    to: 'ACCEPTED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
    preconditions: ['HAS_ASSESSMENT'],
  },
  // ACCEPTED / UNDER_TREATMENT / UNDER_REVIEW -> CLOSED — risk:transition to
  // REQUEST, no precondition, APPROVAL REQUIRED (risk:approve to decide).
  {
    from: 'ACCEPTED',
    to: 'CLOSED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
    preconditions: [],
  },
  {
    from: 'UNDER_TREATMENT',
    to: 'CLOSED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
    preconditions: [],
  },
  {
    from: 'UNDER_REVIEW',
    to: 'CLOSED',
    requiredPermission: 'risk:transition',
    requiresApproval: true,
    preconditions: [],
  },
  // CLOSED -> ARCHIVED — risk:administer, no precondition, no approval.
  {
    from: 'CLOSED',
    to: 'ARCHIVED',
    requiredPermission: 'risk:administer',
    requiresApproval: false,
    preconditions: [],
  },
  // UNDER_REVIEW -> ASSESSED — risk:assess, new assessment recorded, no
  // approval. The reassessment return path.
  {
    from: 'UNDER_REVIEW',
    to: 'ASSESSED',
    requiredPermission: 'risk:assess',
    requiresApproval: false,
    preconditions: ['REASSESSED_DURING_REVIEW'],
  },
];

/** The single lookup every use case uses to answer "is (from, to) legal" —
 * `undefined` for any pair not in the table, which callers must treat as
 * FR-081's refusal, never as "no restriction". */
export function findLifecycleTransition(
  from: RiskStatus,
  to: RiskStatus,
): LifecycleTransitionRule | undefined {
  return RISK_LIFECYCLE_TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}

/** Every legal target from `from` — used by `GetRiskLifecycleUseCase`
 * (T159) to build the `availableTransitions` list (FR-082), filtered
 * further by the caller's held permissions before being returned. */
export function listLifecycleTransitionsFrom(from: RiskStatus): readonly LifecycleTransitionRule[] {
  return RISK_LIFECYCLE_TRANSITIONS.filter((rule) => rule.from === from);
}
