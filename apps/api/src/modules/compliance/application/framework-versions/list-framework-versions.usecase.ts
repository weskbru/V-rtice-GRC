/**
 * T023/004-compliance-management — `ListFrameworkVersionsUseCase`: the
 * read side of `GET /frameworks/{frameworkId}/versions`
 * (`listFrameworkVersions` operation). Confirms the framework exists
 * first — an unknown `frameworkId` answers `404`, never an empty page.
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { FrameworkRepositoryPort } from '../../domain/ports/framework-repository.port';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';

import type {
  FrameworkVersionListPage,
  FrameworkVersionListQuery,
} from '../../domain/ports/framework-version-repository.port';

export interface ListFrameworkVersionsInput {
  readonly frameworkId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: FrameworkVersionListQuery['status'];
}

@Injectable()
export class ListFrameworkVersionsUseCase {
  constructor(
    private readonly frameworkRepository: FrameworkRepositoryPort,
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
  ) {}

  async execute(input: ListFrameworkVersionsInput): Promise<FrameworkVersionListPage> {
    const framework = await this.frameworkRepository.findById(input.frameworkId);
    if (!framework) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkEntityLabel,
        input.frameworkId,
      );
    }

    return this.frameworkVersionRepository.list({
      frameworkId: input.frameworkId,
      page: input.page,
      pageSize: input.pageSize,
      status: input.status,
    });
  }
}
