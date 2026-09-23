import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';

import type { FrameworkVersionRecord } from '../../domain/ports/framework-version-repository.port';

export interface GetFrameworkVersionInput {
  readonly frameworkId: string;
  readonly versionId: string;
}

@Injectable()
export class GetFrameworkVersionUseCase {
  constructor(private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort) {}

  async execute(input: GetFrameworkVersionInput): Promise<FrameworkVersionRecord> {
    const record = await this.frameworkVersionRepository.findById(input.versionId);
    if (record?.framework.id !== input.frameworkId) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkVersionEntityLabel,
        input.versionId,
      );
    }
    return record;
  }
}
