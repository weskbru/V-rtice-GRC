import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import {
  RequirementApplicabilityRepositoryPort,
  type ApplicabilityDeclarationListPage,
} from '../../domain/ports/requirement-applicability-repository.port';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';

export interface ListRequirementApplicabilityDeclarationsInput {
  readonly requirementId: string;
  readonly page: number;
  readonly pageSize: number;
}

@Injectable()
export class ListRequirementApplicabilityDeclarationsUseCase {
  constructor(
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly applicabilityRepository: RequirementApplicabilityRepositoryPort,
  ) {}

  async execute(
    input: ListRequirementApplicabilityDeclarationsInput,
  ): Promise<ApplicabilityDeclarationListPage> {
    const requirement = await this.requirementRepository.findById(input.requirementId);
    if (!requirement) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.requirementEntityLabel,
        input.requirementId,
      );
    }

    return this.applicabilityRepository.list(input.requirementId, input.page, input.pageSize);
  }
}
