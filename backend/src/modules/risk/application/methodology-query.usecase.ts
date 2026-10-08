import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { RiskMethodologyRepositoryPort } from '../domain/ports/risk-methodology-repository.port';

import type { MethodologyVersionRecord } from '../domain/ports/risk-methodology-repository.port';

const METHODOLOGY_ENTITY_LABEL = 'Metodologia de risco';

export interface MethodologyVersionWithActiveFlag {
  readonly version: MethodologyVersionRecord;
  readonly isActive: boolean;
}

export interface ListMethodologyVersionsResult {
  readonly items: readonly MethodologyVersionWithActiveFlag[];
  readonly total: number;
}

@Injectable()
export class MethodologyQueryUseCase {
  constructor(private readonly methodologyRepository: RiskMethodologyRepositoryPort) {}

  async getActiveVersion(): Promise<MethodologyVersionWithActiveFlag> {
    const version = await this.methodologyRepository.findActiveVersion();
    if (!version) {
      throw new NotFoundDomainError(METHODOLOGY_ENTITY_LABEL, 'active');
    }
    return { version, isActive: true };
  }

  async listVersions(page: number, pageSize: number): Promise<ListMethodologyVersionsResult> {
    const [{ items, total }, activeVersion] = await Promise.all([
      this.methodologyRepository.listVersions(page, pageSize),
      this.methodologyRepository.findActiveVersion(),
    ]);

    return {
      items: items.map((version) => ({
        version,
        isActive: version.id === activeVersion?.id,
      })),
      total,
    };
  }
}
