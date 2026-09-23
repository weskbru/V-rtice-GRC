import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { EntityCodeGeneratorPort } from '../../../grc/shared/domain/ports/entity-code-generator.port';
import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { ReportDefinitionRepositoryPort } from '../domain/ports/report-definition-repository.port';
import { ReportReferenceDataPort } from '../domain/ports/report-reference-data.port';

import { assertValidReportMetricKeys } from './assert-report-metric-keys';

import type { ReportUserLookup } from '../domain/ports/report-reference-data.port';
import type { ReportDefinitionRecord } from '../domain/report-definition.entity';

export interface CreateReportDefinitionInput {
  readonly actorUserId: string;
  readonly name: string;
  readonly description: string;
  readonly metricKeys: readonly string[];
}

export interface CreateReportDefinitionResult {
  readonly record: ReportDefinitionRecord;
  readonly createdBy: ReportUserLookup;
}

@Injectable()
export class CreateReportDefinitionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly definitionRepository: ReportDefinitionRepositoryPort,
    private readonly referenceData: ReportReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateReportDefinitionInput): Promise<CreateReportDefinitionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const metricKeys = assertValidReportMetricKeys(input.metricKeys);

    const codeYear = new Date().getUTCFullYear();

    const record = await this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('RPT', codeYear);

      const created = await this.definitionRepository.create({
        code,
        name: input.name,
        description: input.description,
        metricKeys,
        createdByUserId: input.actorUserId,
      });

      await this.auditRecorder.record({
        action: 'report.created',
        entityType: AuditEntityType.REPORT,
        entityId: created.id,
        actorLabel: actor.fullName,
        newValues: {
          code,
          name: input.name,
          description: input.description,
          metricKeys,
          isActive: true,
        },
      });

      return created;
    });

    return { record, createdBy: actor };
  }
}
