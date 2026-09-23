import { incidents } from '@/lib/messages/incidents';

import type { IncidentStatus, IncidentSeverity } from './types';
import type { StatusVariant } from '@pharos/design-system/components';

const SEVERITY_VARIANT: Record<IncidentSeverity, StatusVariant> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

const STATUS_VARIANT: Record<IncidentStatus, StatusVariant> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  CANCELLED: 'neutral',
};

export function incidentSeverityBadgeVariant(severity: IncidentSeverity): StatusVariant {
  return SEVERITY_VARIANT[severity];
}

export function incidentSeverityLabel(severity: IncidentSeverity): string {
  return incidents.severityLabels[severity];
}

export function incidentStatusBadgeVariant(status: IncidentStatus): StatusVariant {
  return STATUS_VARIANT[status];
}

export function incidentStatusLabel(status: IncidentStatus): string {
  return incidents.statusLabels[status];
}

export type IncidentTransitionField = 'resolutionSummary' | 'cancellationReason' | 'reopenReason';

export type IncidentTransitionConfirmKey = 'resolve' | 'close' | 'cancel' | 'reopen';

export interface IncidentTransitionOption {
  readonly to: IncidentStatus;
  readonly label: string;
  readonly requiredField: IncidentTransitionField | undefined;
  readonly confirmKey: IncidentTransitionConfirmKey | undefined;
}

const TRANSITION_OPTIONS_BY_STATUS: Record<IncidentStatus, readonly IncidentTransitionOption[]> = {
  OPEN: [
    {
      to: 'IN_PROGRESS',
      label: incidents.lifecycle.actions.start,
      requiredField: undefined,
      confirmKey: undefined,
    },
    {
      to: 'CANCELLED',
      label: incidents.lifecycle.actions.cancel,
      requiredField: 'cancellationReason',
      confirmKey: 'cancel',
    },
  ],
  IN_PROGRESS: [
    {
      to: 'RESOLVED',
      label: incidents.lifecycle.actions.resolve,
      requiredField: 'resolutionSummary',
      confirmKey: 'resolve',
    },
    {
      to: 'CANCELLED',
      label: incidents.lifecycle.actions.cancel,
      requiredField: 'cancellationReason',
      confirmKey: 'cancel',
    },
  ],
  RESOLVED: [
    {
      to: 'CLOSED',
      label: incidents.lifecycle.actions.close,
      requiredField: undefined,
      confirmKey: 'close',
    },
    {
      to: 'IN_PROGRESS',
      label: incidents.lifecycle.actions.reopen,
      requiredField: 'reopenReason',
      confirmKey: 'reopen',
    },
  ],
  CLOSED: [],
  CANCELLED: [],
};

export function availableIncidentTransitions(
  status: IncidentStatus,
): readonly IncidentTransitionOption[] {
  return TRANSITION_OPTIONS_BY_STATUS[status];
}
