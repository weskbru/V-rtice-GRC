/**
 * T070/002-shared-grc-foundation, US3 — `ListFindingUseCase`
 * (`listFindings`, FR-021, SC-010). Scoped register listing, mirroring
 * `grc/evidence/application/list-evidence.usecase.ts`'s shape (minus the
 * `subjectType`/`subjectId` filter — no US3 requirement calls for it).
 */
import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { FindingRepositoryPort } from '../domain/ports/finding-repository.port';

import type { FindingRecord } from '../domain/ports/finding-repository.port';
import type { FindingSeverity, FindingStatus } from '@prisma/client';

export interface ListFindingInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: FindingStatus | undefined;
  readonly severity?: FindingSeverity | undefined;
  readonly ownerUserId?: string | undefined;
  readonly orgUnitId?: string | undefined;
  readonly withoutRemediation?: boolean | undefined;
}

export interface FindingListResult {
  readonly items: readonly FindingRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

@Injectable()
export class ListFindingUseCase {
  constructor(
    private readonly findingRepository: FindingRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListFindingInput): Promise<FindingListResult> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const page = await this.findingRepository.list(
      scope,
      {
        status: input.status,
        severity: input.severity,
        ownerUserId: input.ownerUserId,
        orgUnitId: input.orgUnitId,
        withoutRemediation: input.withoutRemediation,
      },
      input.page,
      input.pageSize,
    );

    return { items: page.items, page: page.page, pageSize: page.pageSize, total: page.total };
  }
}
