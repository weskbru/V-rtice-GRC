/**
 * T036/004-compliance-management, User Story 2 (research.md D-6) — the
 * per-target-requirement classification algorithm a mapping migration
 * execution applies. Pure, no I/O: exactly the three-way decision D-6
 * documents, taking only the two facts a caller must already have
 * resolved (does the target already have an active link of its own; did
 * the manager's own `correspondences` name this target) — never a lookup,
 * never a heuristic over `externalRef`/text (D-6's own "o sistema
 * explicitamente NÃO tenta inferir").
 */
import type { MappingMigrationOutcome } from '@prisma/client';

/**
 * `sourceRequirementIds` is `undefined` when the target requirement was
 * NOT named in the request body's `correspondences` at all — distinct
 * from an empty array, which the contract's own `MappingMigrationCorrespondence`
 * schema already forbids (`minItems: 1`) but this function does not rely
 * on that upstream guarantee: an empty array is treated identically to
 * `undefined` (no decided correspondence), never as `COPIED` with zero
 * sources.
 */
export function classifyMappingMigrationTarget(
  hasActiveLink: boolean,
  sourceRequirementIds: readonly string[] | undefined,
): MappingMigrationOutcome {
  if (hasActiveLink) {
    // FR-014 — never overwritten, regardless of whether it also appears
    // in `correspondences`.
    return 'SKIPPED_ALREADY_MAPPED';
  }

  if (sourceRequirementIds && sourceRequirementIds.length > 0) {
    return 'COPIED';
  }

  // FR-013 — never silently left unmapped.
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
