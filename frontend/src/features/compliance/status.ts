import {
  CheckCircle2,
  CircleHelp,
  Clock,
  Copy,
  FileEdit,
  Lock,
  MinusCircle,
  TriangleAlert,
  XCircle,
} from 'lucide-react';

import { compliance } from '@/lib/messages/compliance';

import type {
  FrameworkVersionStatus,
  MappingMigrationOutcome,
  RequirementComplianceState,
} from './types';
import type { StatusVariant } from '@pharos/design-system/components';
import type { ComponentType, SVGProps } from 'react';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const VERSION_STATUS_ICON: Record<FrameworkVersionStatus, Icon> = {
  DRAFT: FileEdit,
  PUBLISHED: Lock,
};

const COMPLIANCE_STATE_ICON: Record<RequirementComplianceState, Icon> = {
  NOT_APPLICABLE: MinusCircle,
  NOT_MET: XCircle,
  NOT_PROVEN: CircleHelp,
  PARTIALLY_MET: TriangleAlert,
  COMPLIANT: CheckCircle2,
};

const MAPPING_MIGRATION_OUTCOME_ICON: Record<MappingMigrationOutcome, Icon> = {
  COPIED: Copy,
  PENDING_DECISION: Clock,
  SKIPPED_ALREADY_MAPPED: Lock,
};

export function frameworkVersionStatusBadgeVariant(status: FrameworkVersionStatus): StatusVariant {
  return compliance.frameworkVersionStatusVariant[status];
}

export function frameworkVersionStatusIcon(status: FrameworkVersionStatus): Icon {
  return VERSION_STATUS_ICON[status];
}

export function frameworkVersionStatusLabel(status: FrameworkVersionStatus): string {
  return compliance.frameworkVersionStatusLabels[status];
}

export function complianceStateBadgeVariant(state: RequirementComplianceState): StatusVariant {
  return compliance.complianceStateVariant[state];
}

export function complianceStateIcon(state: RequirementComplianceState): Icon {
  return COMPLIANCE_STATE_ICON[state];
}

export function complianceStateLabel(state: RequirementComplianceState): string {
  return compliance.complianceStateLabels[state];
}

export function complianceStateDescription(state: RequirementComplianceState): string {
  return compliance.complianceStateDescriptions[state];
}

export function mappingMigrationOutcomeBadgeVariant(
  outcome: MappingMigrationOutcome,
): StatusVariant {
  return compliance.mappingMigrationOutcomeVariant[outcome];
}

export function mappingMigrationOutcomeIcon(outcome: MappingMigrationOutcome): Icon {
  return MAPPING_MIGRATION_OUTCOME_ICON[outcome];
}

export function mappingMigrationOutcomeLabel(outcome: MappingMigrationOutcome): string {
  return compliance.mappingMigrationOutcomeLabels[outcome];
}
