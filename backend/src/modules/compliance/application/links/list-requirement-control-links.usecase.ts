import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { RequirementControlLinkRepositoryPort } from '../../domain/ports/requirement-control-link-repository.port';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';

import type { RequirementControlLinkRecord } from '../../domain/requirement-control-link.entity';

export interface ListRequirementControlLinksInput {
  readonly requirementId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListRequirementControlLinksUseCase {
  constructor(
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly linkRepository: RequirementControlLinkRepositoryPort,
  ) {}

  async execute(
    input: ListRequirementControlLinksInput,
  ): Promise<readonly RequirementControlLinkRecord[]> {
    const requirement = await this.requirementRepository.findById(input.requirementId);
    if (!requirement) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.requirementEntityLabel,
        input.requirementId,
      );
    }

    return this.linkRepository.list(input.requirementId, input.includeWithdrawn);
  }
}
