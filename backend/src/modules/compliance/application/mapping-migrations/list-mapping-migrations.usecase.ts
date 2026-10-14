import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';
import {
  RequirementControlMappingMigrationRepositoryPort,
  type MappingMigrationListPage,
} from '../../domain/ports/requirement-control-mapping-migration-repository.port';

export interface ListMappingMigrationsInput {
  readonly frameworkId: string;
  readonly versionId: string;
  readonly page: number;
  readonly pageSize: number;
}

@Injectable()
export class ListMappingMigrationsUseCase {
  constructor(
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
    private readonly migrationRepository: RequirementControlMappingMigrationRepositoryPort,
  ) {}

  async execute(input: ListMappingMigrationsInput): Promise<MappingMigrationListPage> {
    const version = await this.frameworkVersionRepository.findById(input.versionId);
    if (version?.framework.id !== input.frameworkId) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkVersionEntityLabel,
        input.versionId,
      );
    }

    return this.migrationRepository.list(input.versionId, input.page, input.pageSize);
  }
}
