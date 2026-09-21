/**
 * T017/006-assets-processes — `ListAssetsUseCase`: the read side of `GET
 * /assets` (`listAssetCatalog` operation, FR-007). No transaction and no
 * audit entry — reads are not audited (ADR-005), mirroring
 * `ListControlsUseCase`'s own reasoning.
 *
 * **Closes "Vazamento 1" (spec §"Contexto medido")**: unlike the retired
 * `RegistryController.listAssets` (`modules/risk`), which called its
 * repository directly with no `ScopeResolverService` in the path at all,
 * this use case resolves the caller's `ScopeFilter` and hands it to
 * `AssetRepositoryPort.list`, which applies it unconditionally
 * (`PrismaAssetRepository`, extending `AssetScopedRepository`) — an asset
 * outside the caller's scope is neither listed nor counted (FR-010,
 * SC-003b).
 */
import { Injectable } from '@nestjs/common';

import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { AssetRepositoryPort } from '../domain/ports/asset-repository.port';

import type {
  AssetCatalogSortDirection,
  AssetCatalogSortField,
  AssetSummaryRecord,
} from '../domain/ports/asset-repository.port';

export interface ListAssetsInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly q?: string | undefined;
  readonly orgUnitId?: readonly string[] | undefined;
  readonly isActive?: boolean | undefined;
  readonly sortField: AssetCatalogSortField;
  readonly sortDirection: AssetCatalogSortDirection;
}

export interface ListAssetsOutput {
  readonly items: readonly AssetSummaryRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class ListAssetsUseCase {
  constructor(
    private readonly assetRepository: AssetRepositoryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListAssetsInput): Promise<ListAssetsOutput> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const { items, total } = await this.assetRepository.list(
      scope,
      { q: input.q, orgUnitId: input.orgUnitId, isActive: input.isActive },
      { field: input.sortField, direction: input.sortDirection },
      input.page,
      input.pageSize,
    );

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
    };
  }
}
