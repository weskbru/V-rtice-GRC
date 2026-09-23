import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { IndicatorDefinitionRepositoryPort } from '../domain/ports/indicator-definition-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { resolveIndicatorOwnerRef, type IndicatorOwnerRef } from './resolve-indicator-owner';

import type { IndicatorDefinitionRecord } from '../domain/indicator-definition.entity';

export interface GetIndicatorDefinitionResult {
  readonly record: IndicatorDefinitionRecord;
  readonly owner: IndicatorOwnerRef;
}

@Injectable()
export class GetIndicatorDefinitionUseCase {
  constructor(
    private readonly definitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
  ) {}

  async execute(definitionId: string): Promise<GetIndicatorDefinitionResult> {
    const record = await this.definitionRepository.findById(definitionId);
    if (!record) {
      throw new NotFoundDomainError(USER_MESSAGES.indicators.entityLabel, definitionId);
    }

    const owner = await resolveIndicatorOwnerRef(this.referenceData, record.ownerUserId);
    return { record, owner };
  }
}
