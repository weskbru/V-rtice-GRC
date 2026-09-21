/**
 * PharosGRC — control lifecycle/effectiveness display mapping (FR-091
 * equivalent for Controls, CLAUDE.md §18.8).
 *
 * Maps `ControlStatus`/`ControlEffectiveness` to a `StatusBadge` variant
 * and icon. Purely presentational — the lifecycle table itself (which
 * transitions are legal, which preconditions apply) is owned entirely by
 * the server (D-6); nothing here encodes or duplicates that rule set.
 *
 * Effectiveness and status are NEVER conveyed by colour alone (CLAUDE.md
 * §18.8): every value below pairs a distinct icon with its colour and text
 * label, so `EXPIRED` (warning) is never confusable with
 * `PARTIALLY_EFFECTIVE` (also warning) by a colour-blind reader — the icon
 * and the word both differ.
 */
import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock,
  FileEdit,
  HelpCircle,
  PauseCircle,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

import { controls } from '@/lib/messages/controls';

import type { ControlEffectiveness, ControlStatus } from './types';
import type { StatusVariant } from '@pharos/design-system/components';
import type { ComponentType, SVGProps } from 'react';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const STATUS_ICON: Record<ControlStatus, Icon> = {
  DRAFT: FileEdit,
  ACTIVE: CheckCircle2,
  SUSPENDED: PauseCircle,
  RETIRED: Ban,
};

const EFFECTIVENESS_ICON: Record<ControlEffectiveness, Icon> = {
  NOT_ASSESSED: HelpCircle,
  EFFECTIVE: CheckCircle2,
  PARTIALLY_EFFECTIVE: TriangleAlert,
  INEFFECTIVE: XCircle,
  EXPIRED: Clock,
};

export function controlStatusBadgeVariant(status: ControlStatus): StatusVariant {
  return controls.statusVariant[status];
}

export function controlStatusIcon(status: ControlStatus): Icon {
  return STATUS_ICON[status];
}

export function controlStatusLabel(status: ControlStatus): string {
  return controls.statusLabels[status];
}

export function controlEffectivenessBadgeVariant(
  effectiveness: ControlEffectiveness,
): StatusVariant {
  return controls.effectivenessVariant[effectiveness];
}

export function controlEffectivenessIcon(effectiveness: ControlEffectiveness): Icon {
  return EFFECTIVENESS_ICON[effectiveness];
}

export function controlEffectivenessLabel(effectiveness: ControlEffectiveness): string {
  return controls.effectivenessLabels[effectiveness];
}

/** A generic "not set" glyph for a `null` classification field (nature/type/frequency) — never `CircleDashed` reused as a semantic status, only as a neutral placeholder icon. */
export const NOT_SET_ICON: Icon = CircleDashed;
