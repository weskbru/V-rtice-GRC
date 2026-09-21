/**
 * T023/004-compliance-management — `GetFrameworkVersionUseCase`: the read
 * side of `GET /frameworks/{frameworkId}/versions/{versionId}`
 * (`getFrameworkVersion` operation). Confirms the version belongs to the
 * `frameworkId` path parameter — a version resolvable by id but under the
 * wrong framework answers `NotFoundDomainError` exactly like a version
 * that does not exist at all (ADR-009's existence-non-disclosure
 * convention, applied here to routing rather than scope).
 */
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
