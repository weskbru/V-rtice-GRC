/**
 * PharosGRC — Incident status/severity display mapping and UI-only
 * transition affordances (008-incidents-problems, US1).
 *
 * Purely presentational, mirroring `features/actions/status.ts`'s own
 * reasoning: the lifecycle itself (which transitions are legal, which
 * field each one requires) is owned entirely by the server
 * (`modules/problems/domain/problem-lifecycle.ts`'s sibling on the
 * Incidents side). `INCIDENT_TRANSITIONS` below exists ONLY to decide
 * which buttons this screen offers — every transition it enables is
 * re-validated, independently and authoritatively, by
 * `POST /incidents/{id}/transitions` on submit (CLAUDE.md §18.9). There is
 * no `GET /incidents/{id}/lifecycle` endpoint (unlike `Risk`/`Control`) —
 * `incidents.openapi.yaml` never declared one — so this client-side table
 * is the only source for "what buttons show", never a server round trip.
 *
 * `StatusBadge` (color + a real pt-BR word, always) is this product's own
 * already-established non-colour-plus-colour indicator (CLAUDE.md §18.8) —
 * `incidentSeverityBadgeVariant`/`incidentStatusBadgeVariant` below supply
 * the colour half; `incidents.severityLabels`/`.statusLabels`
 * (`lib/messages/incidents.ts`) supply the word half. Mirrors
 * `findings-panel.tsx`'s own `SEVERITY_VARIANT`/`STATUS_VARIANT` maps.
 */
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

/** Which extra field, if any, a transition requires — drives whether the
 * lifecycle action opens a reason dialog and which field it asks for.
 * Mirrors data-model.md's Invariants I1 (`resolutionSummary`)/I2
 * (`cancellationReason`) and the reopen edge's own `reopenReason`
 * requirement. */
export type IncidentTransitionField = 'resolutionSummary' | 'cancellationReason' | 'reopenReason';

/** Keys into `incidents.lifecycle.confirm` — every transition except the
 * plain `OPEN -> IN_PROGRESS` start has one, even `close` (no required
 * field, but still a real, one-way step the catalog's own copy warns
 * about: descriptive fields stop being editable). `undefined` means the
 * transition applies immediately, with no confirmation dialog at all. */
export type IncidentTransitionConfirmKey = 'resolve' | 'close' | 'cancel' | 'reopen';

export interface IncidentTransitionOption {
  readonly to: IncidentStatus;
  readonly label: string;
  readonly requiredField: IncidentTransitionField | undefined;
  readonly confirmKey: IncidentTransitionConfirmKey | undefined;
}

/**
 * UI-only mirror of `incidents.openapi.yaml`'s own `transitionIncident`
 * description (also mirrored server-side by whichever module owns
 * `incident-lifecycle.ts`) — kept in the SAME shape (a table keyed by
 * `from`) as `ACTION_TRANSITIONS`/`problem-lifecycle.ts`'s table, so a
 * future change to either is easy to notice and mirror here rather than
 * drifting silently. `CLOSED`/`CANCELLED` are terminal — empty arrays,
 * never omitted keys, so `availableTransitions` stays a total function
 * over `IncidentStatus`.
 */
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
