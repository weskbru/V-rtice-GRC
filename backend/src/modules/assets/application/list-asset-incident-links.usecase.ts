import { Injectable } from '@nestjs/common';

import { IncidentAssetLinkReadPort } from '../../../shared/grc-ports/incident-asset-link-read.port';

import { GetAssetUseCase } from './get-asset.usecase';

import type { IncidentAssetLinkReadRecord } from '../../../shared/grc-ports/incident-asset-link-read.port';

export interface ListAssetIncidentLinksInput {
  readonly actorUserId: string;
  readonly assetId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListAssetIncidentLinksUseCase {
  constructor(
    private readonly getAssetUseCase: GetAssetUseCase,
    private readonly incidentAssetLinkRead: IncidentAssetLinkReadPort,
  ) {}

  async execute(
    input: ListAssetIncidentLinksInput,
  ): Promise<readonly IncidentAssetLinkReadRecord[]> {
    await this.getAssetUseCase.execute({ actorUserId: input.actorUserId, assetId: input.assetId });
    return this.incidentAssetLinkRead.listByAsset(input.assetId, input.includeWithdrawn);
  }
}
