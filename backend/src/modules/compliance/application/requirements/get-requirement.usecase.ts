import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';
import { RequirementComplianceReaderService } from '../requirement-compliance-reader.service';

import type { RequirementRecord } from '../../domain/ports/requirement-repository.port';

@Injectable()
export class GetRequirementUseCase {
  constructor(
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly complianceReader: RequirementComplianceReaderService,
  ) {}

  async execute(requirementId: string): Promise<RequirementRecord> {
    const row = await this.requirementRepository.findById(requirementId);
    if (!row) {
      throw new NotFoundDomainError(USER_MESSAGES.compliance.requirementEntityLabel, requirementId);
    }

    const derived = await this.complianceReader.deriveForOne(row.id, new Date());
    return { ...row, ...derived };
  }
}
