import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { validateMethodologyConfiguration } from '../domain/methodology.schema';
import { RiskMethodologyRepositoryPort } from '../domain/ports/risk-methodology-repository.port';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';

import type {
  LevelBandConfig,
  MatrixCellConfig,
  ScalePointConfig,
} from '../domain/methodology.schema';
import type { MethodologyVersionRecord } from '../domain/ports/risk-methodology-repository.port';

export interface PublishMethodologyVersionInput {
  readonly actorUserId: string;
  readonly probabilityScale: readonly ScalePointConfig[];
  readonly impactScale: readonly ScalePointConfig[];
  readonly matrix: readonly MatrixCellConfig[];
  readonly levelBands: readonly LevelBandConfig[];
  readonly effectiveFrom?: string | undefined;
}

@Injectable()
export class PublishMethodologyVersionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly methodologyRepository: RiskMethodologyRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: PublishMethodologyVersionInput): Promise<MethodologyVersionRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    validateMethodologyConfiguration({
      probabilityScale: input.probabilityScale,
      impactScale: input.impactScale,
      matrix: input.matrix,
      levelBands: input.levelBands,
    });

    const methodologyId = await this.methodologyRepository.findActiveMethodologyId();
    if (!methodologyId) {
      throw new ValidationDomainError(USER_MESSAGES.risk.methodology.noActiveMethodology, [
        {
          field: 'probabilityScale',
          message: USER_MESSAGES.risk.methodology.noActiveMethodology,
        },
      ]);
    }

    const now = new Date();
    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : now;
    if (effectiveFrom.getTime() < now.getTime()) {
      throw new ValidationDomainError(USER_MESSAGES.risk.methodology.invalidConfiguration, [
        { field: 'effectiveFrom', message: USER_MESSAGES.risk.methodology.invalidConfiguration },
      ]);
    }

    return this.transactionRunner.run(async () => {
      const version = await this.methodologyRepository.createVersion({
        methodologyId,
        probabilityScale: input.probabilityScale,
        impactScale: input.impactScale,
        matrix: input.matrix,
        levelBands: input.levelBands,
        effectiveFrom,
        createdByUserId: input.actorUserId,
      });

      await this.auditRecorder.record({
        action: 'risk_methodology_version.published',
        entityType: AuditEntityType.RISK_METHODOLOGY_VERSION,
        entityId: version.id,
        actorLabel: actor.fullName,
        newValues: {
          methodologyId,
          versionNumber: version.versionNumber,
          effectiveFrom,
        },
      });

      return version;
    });
  }
}
