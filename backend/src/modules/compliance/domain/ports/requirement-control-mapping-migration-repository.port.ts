import type {
  MappingMigrationDetailRecord,
  MappingMigrationSummaryRecord,
} from '../requirement-control-mapping-migration.entity';
import type { MappingMigrationOutcome } from '@prisma/client';

export interface CreateMappingMigrationItemInput {
  readonly targetRequirementId: string;
  readonly sourceRequirementIds: readonly string[];
  readonly outcome: MappingMigrationOutcome;
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

  abstract list(
    targetFrameworkVersionId: string,
    page: number,
    pageSize: number,
  ): Promise<MappingMigrationListPage>;
}
