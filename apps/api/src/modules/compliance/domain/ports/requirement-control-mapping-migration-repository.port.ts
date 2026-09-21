/**
 * T036/004-compliance-management, User Story 2 — port for
 * `RequirementControlMappingMigration`/`RequirementControlMappingMigrationItem`
 * (data-model.md §5). `create` persists the whole execution — the
 * migration row, every item row, and every `COPIED` item's new
 * `RequirementControlLink` rows — as one write, so `ExecuteMappingMigrationUseCase`
 * (T036) can wrap it in a single transaction alongside the one audit
 * event SC-004 requires.
 */
import type {
  MappingMigrationDetailRecord,
  MappingMigrationSummaryRecord,
} from '../requirement-control-mapping-migration.entity';
import type { MappingMigrationOutcome } from '@prisma/client';

export interface CreateMappingMigrationItemInput {
  readonly targetRequirementId: string;
  readonly sourceRequirementIds: readonly string[];
  readonly outcome: MappingMigrationOutcome;
  /** Control ids to link onto `targetRequirementId` — non-empty only when
   * `outcome === 'COPIED'`. The repository creates one
   * `RequirementControlLink` row per id, alongside the item row, in the
   * same write. */
  readonly controlIdsToLink: readonly string[];
}

export interface CreateMappingMigrationInput {
  readonly frameworkId: string;
  readonly sourceFrameworkVersionId: string;
  readonly targetFrameworkVersionId: string;
  readonly executedByUserId: string;
  readonly executedAt: Date;
  readonly items: readonly CreateMappingMigrationItemInput[];
}

export interface MappingMigrationListPage {
  readonly items: readonly MappingMigrationSummaryRecord[];
  readonly total: number;
}

export abstract class RequirementControlMappingMigrationRepositoryPort {
  abstract create(input: CreateMappingMigrationInput): Promise<MappingMigrationDetailRecord>;

  abstract findById(
    targetFrameworkVersionId: string,
    migrationId: string,
  ): Promise<MappingMigrationDetailRecord | undefined>;

  /** Newest first by `executedAt` (contract's own `listMappingMigrations`
   * description). */
  abstract list(
    targetFrameworkVersionId: string,
    page: number,
    pageSize: number,
  ): Promise<MappingMigrationListPage>;
}
