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

export type ProblemTransitionField = 'rootCause' | 'cancellationReason' | 'reopenReason';

export interface ProblemTransitionOption {
  readonly to: ProblemStatus;
  readonly label: string;
  readonly requiredField: ProblemTransitionField | undefined;
}

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
