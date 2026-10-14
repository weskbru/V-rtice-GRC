import type { MappingMigrationOutcome } from '@prisma/client';

export function classifyMappingMigrationTarget(
  hasActiveLink: boolean,
  sourceRequirementIds: readonly string[] | undefined,
): MappingMigrationOutcome {
  if (hasActiveLink) {
    return 'SKIPPED_ALREADY_MAPPED';
  }

  if (sourceRequirementIds && sourceRequirementIds.length > 0) {
    return 'COPIED';
  }

  return 'PENDING_DECISION';
}

export interface MappingMigrationRequirementRef {
  readonly id: string;
  readonly externalRef: string;
  readonly title: string;
}

export interface MappingMigrationItemRecord {
  readonly targetRequirement: MappingMigrationRequirementRef;
  readonly sourceRequirements: readonly MappingMigrationRequirementRef[];
  readonly outcome: MappingMigrationOutcome;
  readonly copiedLinkCount: number;
}

export interface MappingMigrationUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface MappingMigrationFrameworkVersionRef {
  readonly id: string;
  readonly label: string;
  readonly status: 'DRAFT' | 'PUBLISHED';
}

export interface MappingMigrationSummaryRecord {
  readonly id: string;
  readonly sourceFrameworkVersion: MappingMigrationFrameworkVersionRef;
  readonly targetFrameworkVersion: MappingMigrationFrameworkVersionRef;
  readonly executedBy: MappingMigrationUserRef;
  readonly executedAt: Date;
  readonly itemCount: number;
  readonly copiedCount: number;
  readonly pendingDecisionCount: number;
  readonly skippedAlreadyMappedCount: number;
}

export interface MappingMigrationDetailRecord extends MappingMigrationSummaryRecord {
  readonly items: readonly MappingMigrationItemRecord[];
}
