/**
 * 009-indicators-reports, Fase 3 (T031) — `ListIndicatorDefinitionsUseCase`
 * (`listIndicatorDefinitions`). No `ScopeFilter` (research.md D-8, data-
 * model.md §8: "nenhum — definição é compartilhada") — every caller with
 * `indicator:view` sees every configured definition, paginated and
 * optionally filtered by `isActive`.
 */
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

    // At most eleven rows can ever exist (one per closed catalog key,
    // data-model.md §1's `metricKey UNIQUE`) — a per-row owner lookup here
    // is never an unbounded N+1, unlike a genuinely large, growing table.
    const items = await Promise.all(
      page.items.map(async (record) => ({
        record,
        owner: await resolveIndicatorOwnerRef(this.referenceData, record.ownerUserId),
      })),
    );

    return { items, total: page.total };
  }
}
