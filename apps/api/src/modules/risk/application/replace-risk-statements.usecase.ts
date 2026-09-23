import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
} from '../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../domain/ports/risk-repository.port';
import { assertBusinessContentEditable } from '../domain/risk.entity';

import type { RiskRecord, RiskStatementRecord } from '../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';

export type RiskStatementKind = 'causes' | 'consequences';

export interface ReplaceRiskStatementsInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly kind: RiskStatementKind;
  readonly expectedVersion: number;
  readonly items: readonly string[];
}

export interface ReplaceRiskStatementsResult {
  readonly items: readonly RiskStatementRecord[];
  readonly risk: RiskRecord;
}

function descriptionsOf(statements: readonly RiskStatementRecord[]): readonly string[] {
  return statements.map((statement) => statement.description);
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

@Injectable()
export class ReplaceRiskStatementsUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: ReplaceRiskStatementsInput): Promise<ReplaceRiskStatementsResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const current = await this.riskRepository.findById(scope, input.riskId);
    if (!current) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    assertBusinessContentEditable(current.status);

    const previousDescriptions = descriptionsOf(
      input.kind === 'causes' ? current.causes : current.consequences,
    );
    const newDescriptions = input.items;

    return this.transactionRunner.run(async () => {
      const items =
        input.kind === 'causes'
          ? await this.riskRepository.replaceCauses(input.riskId, input.items)
          : await this.riskRepository.replaceConsequences(input.riskId, input.items);

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }

      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      if (!arraysEqual(previousDescriptions, newDescriptions)) {
        await this.auditRecorder.record({
          action: input.kind === 'causes' ? 'risk.causes_replaced' : 'risk.consequences_replaced',
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          actorLabel: actor.fullName,
          previousValues: { [input.kind]: previousDescriptions },
          newValues: { [input.kind]: newDescriptions },
          organizationalUnitId: result.record.orgUnit.id,
        });
      }

      return { items, risk: result.record };
    });
  }
}
