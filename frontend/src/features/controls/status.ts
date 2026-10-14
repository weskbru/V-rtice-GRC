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
import type { StatusVariant } from '@vertice/design-system/components';
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

export const NOT_SET_ICON: Icon = CircleDashed;
