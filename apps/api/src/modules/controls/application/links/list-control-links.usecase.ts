/**
 * T037-T038/003-controls-management, User Story 3 —
 * `ListControlProcessLinksUseCase`/`ListControlAssetLinksUseCase`/
 * `ListControlRiskLinksUseCase`. `GET
 * /controls/{controlId}/processes|assets|risks`. All three require
 * `control:view` and scope, resolved identically via
 * `ControlAccessResolver` before reading the requested link table.
 */
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

/** T038, FR-021 — read-only: reads the existing `RiskControlLink`,
 * creates/removes nothing (that remains exclusively
 * `POST`/`DELETE /risks/{riskId}/controls` on the Risk side). */
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
