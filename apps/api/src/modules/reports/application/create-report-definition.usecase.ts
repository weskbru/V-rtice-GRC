/**
 * 009-indicators-reports, Fase 7 (T051) — `CreateReportDefinitionUseCase`
 * (`createReportDefinition`, spec.md FR-022/FR-023/FR-024,
 * contracts/reports.openapi.yaml). Mirrors
 * `modules/indicators/application/create-indicator-definition.usecase.ts`'s
 * shape — see that file's header for the transaction-boundary reasoning
 * this one does not repeat.
 *
 * ## Order of checks (all before the transaction opens)
 *
 * 1. `metricKeys` must be non-empty (data-model.md §1).
 * 2. Every element of `metricKeys` must be a member of the closed
 *    `IndicatorMetricKey` catalog (FR-022).
 *
 * Both of the above are `assertValidReportMetricKeys`'s own job
 * (`./assert-report-metric-keys.ts`, Fase 8, T068 prep) — extracted out of
 * this file (unchanged in behavior) the first time a SECOND caller
 * (`UpdateReportDefinitionUseCase`) needed the identical rule (CLAUDE.md
 * §19.7, "one validator, never a second copy"). See that file's own header
 * for why membership is checked against `Object.values(IndicatorMetricKey)`
 * — the Prisma-GENERATED enum — rather than against
 * `modules/indicators/domain/indicator-metric-catalog.ts`'s own
 * `isIndicatorMetricKey` (module-isolation, `apps/api/eslint.config.mjs`).
 * This use case's own input stays a raw `readonly string[]`, never
 * `readonly IndicatorMetricKey[]`, so this check runs regardless of
 * whatever the DTO (`CreateReportDefinitionRequestDto`, T054) also
 * enforces — defense-in-depth, reached by a caller bypassing the DTO
 * entirely (e.g. this feature's own integration tests).
 *
 * `code` is never client-supplied — allocated from
 * `EntityCodeGeneratorPort.nextCode('RPT', year)` inside the same
 * transaction as the row insert (research.md D-9). Always created
 * `isActive: true` (schema default, FR-023) — no `isActive` field on this
 * use case's input at all.
 */
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
  /** Validated against the closed catalog INSIDE this use case (see this
   * file's own header) — hence `readonly string[]`, not
   * `readonly IndicatorMetricKey[]`. */
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
