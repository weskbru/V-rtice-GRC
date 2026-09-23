import { Injectable } from '@nestjs/common';

import { RiskControlLinkReadPort } from '../../../../shared/grc-ports/risk-control-link-read.port';
import {
  ControlAssetLinkRepositoryPort,
  ControlProcessLinkRepositoryPort,
} from '../../domain/ports/control-relationship-repository.port';
import { ControlAccessResolver } from '../control-access-resolver.service';

import type { RiskControlLinkReadRecord } from '../../../../shared/grc-ports/risk-control-link-read.port';
import type { ControlEntityLinkRecord } from '../../domain/ports/control-relationship-repository.port';

export interface ListControlLinksInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListControlProcessLinksUseCase {
  constructor(
    private readonly controlAccess: ControlAccessResolver,
    private readonly processLinkRepository: ControlProcessLinkRepositoryPort,
  ) {}

  async execute(input: ListControlLinksInput): Promise<readonly ControlEntityLinkRecord[]> {
    await this.controlAccess.resolveControl(input.actorUserId, input.controlId);
    return this.processLinkRepository.listByControl(input.controlId, input.includeWithdrawn);
  }
}

@Injectable()
export class ListControlAssetLinksUseCase {
  constructor(
    private readonly controlAccess: ControlAccessResolver,
    private readonly assetLinkRepository: ControlAssetLinkRepositoryPort,
  ) {}

  async execute(input: ListControlLinksInput): Promise<readonly ControlEntityLinkRecord[]> {
    await this.controlAccess.resolveControl(input.actorUserId, input.controlId);
    return this.assetLinkRepository.listByControl(input.controlId, input.includeWithdrawn);
  }
}

@Injectable()
export class ListControlRiskLinksUseCase {
  constructor(
    private readonly controlAccess: ControlAccessResolver,
    private readonly riskControlLinkRead: RiskControlLinkReadPort,
  ) {}

  async execute(input: ListControlLinksInput): Promise<readonly RiskControlLinkReadRecord[]> {
    await this.controlAccess.resolveControl(input.actorUserId, input.controlId);
    return this.riskControlLinkRead.listByControl(input.controlId, input.includeWithdrawn);
  }
}
