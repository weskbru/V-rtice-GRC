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
