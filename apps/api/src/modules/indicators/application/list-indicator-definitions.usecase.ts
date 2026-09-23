import { Injectable } from '@nestjs/common';

import { IndicatorDefinitionRepositoryPort } from '../domain/ports/indicator-definition-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { resolveIndicatorOwnerRef, type IndicatorOwnerRef } from './resolve-indicator-owner';

import type { IndicatorDefinitionRecord } from '../domain/indicator-definition.entity';

export interface ListIndicatorDefinitionsInput {
  readonly page: number;
  readonly pageSize: number;
  readonly isActive: boolean | undefined;
}

export interface IndicatorDefinitionWithOwner {
  readonly record: IndicatorDefinitionRecord;
  readonly owner: IndicatorOwnerRef;
}

export interface ListIndicatorDefinitionsResult {
  readonly items: readonly IndicatorDefinitionWithOwner[];
  readonly total: number;
}

@Injectable()
export class ListIndicatorDefinitionsUseCase {
  constructor(
    private readonly definitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
  ) {}

  async execute(input: ListIndicatorDefinitionsInput): Promise<ListIndicatorDefinitionsResult> {
    const page = await this.definitionRepository.list({
      page: input.page,
      pageSize: input.pageSize,
      isActive: input.isActive,
    });

    const items = await Promise.all(
      page.items.map(async (record) => ({
        record,
        owner: await resolveIndicatorOwnerRef(this.referenceData, record.ownerUserId),
      })),
    );

    return { items, total: page.total };
  }
}
