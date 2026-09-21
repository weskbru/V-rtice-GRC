/**
 * PharosGRC — problem lifecycle/severity display mapping (CLAUDE.md §18.8).
 *
 * Maps `ProblemStatus`/`ProblemSeverity` to a `StatusBadge` variant and
 * icon — status is never conveyed by colour alone: every value below
 * pairs a distinct icon with its colour and text label, mirroring
 * `features/controls/status.ts`'s own discipline.
 */
import { AlertOctagon, Ban, CheckCircle2, CircleDot, Search, TriangleAlert } from 'lucide-react';

import { problems } from '@/lib/messages/problems';

import type { ProblemSeverity, ProblemStatus } from './types';
import type { StatusVariant } from '@pharos/design-system/components';
import type { ComponentType, SVGProps } from 'react';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const STATUS_VARIANT: Record<ProblemStatus, StatusVariant> = {
  OPEN: 'neutral',
  IN_ANALYSIS: 'info',
  RESOLVED: 'success',
  CLOSED: 'success',
  CANCELLED: 'neutral',
};

const STATUS_ICON: Record<ProblemStatus, Icon> = {
  OPEN: CircleDot,
  IN_ANALYSIS: Search,
  RESOLVED: CheckCircle2,
  CLOSED: CheckCircle2,
  CANCELLED: Ban,
};

const SEVERITY_VARIANT: Record<ProblemSeverity, StatusVariant> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

const SEVERITY_ICON: Record<ProblemSeverity, Icon> = {
  CRITICAL: AlertOctagon,
  HIGH: TriangleAlert,
  MEDIUM: TriangleAlert,
  LOW: CircleDot,
};

export function problemStatusBadgeVariant(status: ProblemStatus): StatusVariant {
  return STATUS_VARIANT[status];
}

export function problemStatusIcon(status: ProblemStatus): Icon {
  return STATUS_ICON[status];
}

export function problemStatusLabel(status: ProblemStatus): string {
  return problems.statusLabels[status];
}

export function problemSeverityBadgeVariant(severity: ProblemSeverity): StatusVariant {
  return SEVERITY_VARIANT[severity];
}

export function problemSeverityIcon(severity: ProblemSeverity): Icon {
  return SEVERITY_ICON[severity];
}

export function problemSeverityLabel(severity: ProblemSeverity): string {
  return problems.severityLabels[severity];
}

/** Which extra field, if any, a transition requires — drives whether the
 * lifecycle action opens a reason dialog and which field it asks for.
 * Mirrors data-model.md's Invariants P1 (`rootCause`)/the cancellation
 * reason requirement and the reopen edge's own `reopenReason` requirement
 * — the same shape `features/incidents/status.ts#IncidentTransitionField`
 * establishes. `CLOSED` carries no extra field of its own (its gate is
 * the completed-corrective-action/segregation-of-duties pair, checked by
 * `ProblemCloseDialog`, never a text field). */
export type ProblemTransitionField = 'rootCause' | 'cancellationReason' | 'reopenReason';

export interface ProblemTransitionOption {
  readonly to: ProblemStatus;
  readonly label: string;
  readonly requiredField: ProblemTransitionField | undefined;
}

/**
 * UI-only mirror of `problems.openapi.yaml`'s own `transitionProblem`
 * description — kept in the SAME shape (a table keyed by `from`) as
 * `features/incidents/status.ts#TRANSITION_OPTIONS_BY_STATUS`, so a future
 * change to either is easy to notice and mirror. `CLOSED`/`CANCELLED` are
 * terminal — empty arrays, never omitted keys, so `availableProblemTransitions`
 * stays a total function over `ProblemStatus`. Every transition offered
 * here is re-validated, independently and authoritatively, by
 * `POST /problems/{id}/transitions` on submit (CLAUDE.md §18.9) — this
 * table decides only which buttons the screen shows.
 */
const TRANSITION_OPTIONS_BY_STATUS: Record<ProblemStatus, readonly ProblemTransitionOption[]> = {
  OPEN: [
    {
      to: 'IN_ANALYSIS',
      label: problems.lifecycle.actions.startAnalysis,
      requiredField: undefined,
    },
    {
      to: 'CANCELLED',
      label: problems.lifecycle.actions.cancel,
      requiredField: 'cancellationReason',
    },
  ],
  IN_ANALYSIS: [
    { to: 'RESOLVED', label: problems.lifecycle.actions.resolve, requiredField: 'rootCause' },
    {
      to: 'CANCELLED',
      label: problems.lifecycle.actions.cancel,
      requiredField: 'cancellationReason',
    },
  ],
  RESOLVED: [
    { to: 'CLOSED', label: problems.lifecycle.actions.close, requiredField: undefined },
    { to: 'IN_ANALYSIS', label: problems.lifecycle.actions.reopen, requiredField: 'reopenReason' },
  ],
  CLOSED: [],
  CANCELLED: [],
};

export function availableProblemTransitions(
  status: ProblemStatus,
): readonly ProblemTransitionOption[] {
  return TRANSITION_OPTIONS_BY_STATUS[status];
}
