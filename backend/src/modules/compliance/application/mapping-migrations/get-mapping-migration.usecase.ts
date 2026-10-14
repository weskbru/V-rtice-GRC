import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';
import { RequirementControlMappingMigrationRepositoryPort } from '../../domain/ports/requirement-control-mapping-migration-repository.port';

import type { MappingMigrationDetailRecord } from '../../domain/requirement-control-mapping-migration.entity';

export interface GetMappingMigrationInput {
  readonly frameworkId: string;
  readonly versionId: string;
  readonly migrationId: string;
}

@Injectable()
export class GetMappingMigrationUseCase {
  constructor(
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
    private readonly migrationRepository: RequirementControlMappingMigrationRepositoryPort,
  ) {}

  async execute(input: GetMappingMigrationInput): Promise<MappingMigrationDetailRecord> {
    const version = await this.frameworkVersionRepository.findById(input.versionId);
    if (version?.framework.id !== input.frameworkId) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkVersionEntityLabel,
        input.versionId,
      );
    }

    const migration = await this.migrationRepository.findById(input.versionId, input.migrationId);
    if (!migration) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.mappingMigrationEntityLabel,
        input.migrationId,
      );
    }

    return migration;
  }
}
