import type {
  MappingMigrationDetailRecord,
  MappingMigrationFrameworkVersionRef,
  MappingMigrationItemRecord,
  MappingMigrationRequirementRef,
  MappingMigrationSummaryRecord,
  MappingMigrationUserRef,
} from '../../domain/requirement-control-mapping-migration.entity';
import type { MappingMigrationOutcome } from '@prisma/client';

export interface MappingMigrationSummaryResponse {
  readonly id: string;
  readonly sourceFrameworkVersion: MappingMigrationFrameworkVersionRef;
  readonly targetFrameworkVersion: MappingMigrationFrameworkVersionRef;
  readonly executedBy: MappingMigrationUserRef;
  readonly executedAt: string;
  readonly itemCount: number;
  readonly copiedCount: number;
  readonly pendingDecisionCount: number;
  readonly skippedAlreadyMappedCount: number;
}

export interface MappingMigrationItemResponse {
  readonly targetRequirement: MappingMigrationRequirementRef;
  readonly sourceRequirements: readonly MappingMigrationRequirementRef[];
  readonly outcome: MappingMigrationOutcome;
  readonly copiedLinkCount: number;
}

export interface MappingMigrationDetailResponse extends MappingMigrationSummaryResponse {
  readonly items: readonly MappingMigrationItemResponse[];
}

export function toMappingMigrationSummaryResponse(
  record: MappingMigrationSummaryRecord,
): MappingMigrationSummaryResponse {
  return {
    id: record.id,
    sourceFrameworkVersion: record.sourceFrameworkVersion,
    targetFrameworkVersion: record.targetFrameworkVersion,
    executedBy: record.executedBy,
    executedAt: record.executedAt.toISOString(),
    itemCount: record.itemCount,
    copiedCount: record.copiedCount,
    pendingDecisionCount: record.pendingDecisionCount,
    skippedAlreadyMappedCount: record.skippedAlreadyMappedCount,
  };
}

function toItemResponse(item: MappingMigrationItemRecord): MappingMigrationItemResponse {
  return {
    targetRequirement: item.targetRequirement,
    sourceRequirements: item.sourceRequirements,
    outcome: item.outcome,
    copiedLinkCount: item.copiedLinkCount,
  };
}

export function toMappingMigrationDetailResponse(
  record: MappingMigrationDetailRecord,
): MappingMigrationDetailResponse {
  return {
    ...toMappingMigrationSummaryResponse(record),
    items: record.items.map(toItemResponse),
  };
}
