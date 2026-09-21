/**
 * T021/004-compliance-management — `GetFrameworkUseCase`: the read side of
 * `GET /frameworks/{frameworkId}` (`getFramework` operation). No scope
 * resolution, no scope-denial recording (research.md D-2) — unlike
 * `GetControlUseCase`, a `Framework` that does not exist is simply
 * `NotFoundDomainError`, never a scope question.
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { FrameworkRepositoryPort } from '../../domain/ports/framework-repository.port';

import type { FrameworkRecord } from '../../domain/framework.entity';

@Injectable()
export class GetFrameworkUseCase {
  constructor(private readonly frameworkRepository: FrameworkRepositoryPort) {}

  async execute(frameworkId: string): Promise<FrameworkRecord> {
    const record = await this.frameworkRepository.findById(frameworkId);
    if (!record) {
      throw new NotFoundDomainError(USER_MESSAGES.compliance.frameworkEntityLabel, frameworkId);
    }
    return record;
  }
}
