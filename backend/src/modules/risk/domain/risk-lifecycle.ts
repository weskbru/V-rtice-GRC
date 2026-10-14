import type { PermissionIdentifier } from '../../../core/authorization/domain/permissions';
import type { RiskStatus } from '@prisma/client';

export type TransitionPreconditionId =
  | 'DRAFT_FIELDS_COMPLETE'
  | 'HAS_ASSESSMENT'
  | 'HAS_TREATMENT_DECISION'
  | 'REASSESSED_DURING_REVIEW';

export interface LifecycleTransitionRule {
  readonly from: RiskStatus;
  readonly to: RiskStatus;
  readonly requiredPermission: PermissionIdentifier;
  readonly requiresApproval: boolean;
  readonly preconditions: readonly TransitionPreconditionId[];
}

export const RISK_LIFECYCLE_TRANSITIONS: readonly LifecycleTransitionRule[] = [
  {
    from: 'DRAFT',
    to: 'IDENTIFIED',
    requiredPermission: 'risk:edit',
    requiresApproval: false,
    preconditions: ['DRAFT_FIELDS_COMPLETE'],
  },
  {
    from: 'IDENTIFIED',
    to: 'ASSESSED',
    requiredPermission: 'risk:assess',
    requiresApproval: false,
    preconditions: ['HAS_ASSESSMENT'],
  },
  {
    from: 'ASSESSED',
    to: 'UNDER_TREATMENT',
    requiredPermission: 'risk:treat',
    requiresApproval: false,
    preconditions: ['HAS_TREATMENT_DECISION'],
  },
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
  {
    from: 'CLOSED',
    to: 'ARCHIVED',
    requiredPermission: 'risk:administer',
    requiresApproval: false,
    preconditions: [],
  },
  {
    from: 'UNDER_REVIEW',
    to: 'ASSESSED',
    requiredPermission: 'risk:assess',
    requiresApproval: false,
    preconditions: ['REASSESSED_DURING_REVIEW'],
  },
];

export function findLifecycleTransition(
  from: RiskStatus,
  to: RiskStatus,
): LifecycleTransitionRule | undefined {
  return RISK_LIFECYCLE_TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}

export function listLifecycleTransitionsFrom(from: RiskStatus): readonly LifecycleTransitionRule[] {
  return RISK_LIFECYCLE_TRANSITIONS.filter((rule) => rule.from === from);
}
