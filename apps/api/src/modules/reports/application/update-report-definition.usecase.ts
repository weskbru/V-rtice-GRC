/**
 * 009-indicators-reports, Fase 8 (T068 prep) — `UpdateReportDefinitionUseCase`
 * (`updateReportDefinition`, `PATCH /reports/{reportId}`). No
 * `ScopeFilter`/optimistic lock (research.md D-8; `ReportDefinition` has no
 * `version` column, and `contracts/reports.openapi.yaml`'s own
 * `UpdateReportDefinitionRequest` declares no `minProperties`). Mirrors
 * `modules/indicators/application/update-indicator-definition.usecase.ts`'s
 * field-by-field diff shape — see that file's header for the
 * audit-only-when-changed reasoning this one does not repeat.
 *
 * `metricKeys`, when supplied, is re-validated by the SAME
 * `assertValidReportMetricKeys` function `CreateReportDefinitionUseCase`
 * uses (CLAUDE.md §19.7) — non-empty, closed catalog membership — never a
 * second copy of that rule.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { NotFoundDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { ReportDefinitionRepositoryPort } from '../domain/ports/report-definition-repository.port';
import { ReportReferenceDataPort } from '../domain/ports/report-reference-data.port';

import { assertValidReportMetricKeys } from './assert-report-metric-keys';
import { resolveReportCreatedByRef } from './resolve-report-created-by';

import type { ReportCreatedByRef } from './resolve-report-created-by';
import type { UpdateReportDefinitionChanges } from '../domain/ports/report-definition-repository.port';
import type { ReportDefinitionRecord } from '../domain/report-definition.entity';

export interface UpdateReportDefinitionInput {
  readonly actorUserId: string;
  readonly reportId: string;
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly metricKeys?: readonly string[] | undefined;
  readonly isActive?: boolean | undefined;
}

export interface UpdateReportDefinitionResult {
  readonly record: ReportDefinitionRecord;
  readonly createdBy: ReportCreatedByRef;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

@Injectable()
export class UpdateReportDefinitionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly definitionRepository: ReportDefinitionRepositoryPort,
    private readonly referenceData: ReportReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: UpdateReportDefinitionInput): Promise<UpdateReportDefinitionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const current = await this.definitionRepository.findById(input.reportId);
    if (!current) {
      throw new NotFoundDomainError(USER_MESSAGES.reports.entityLabel, input.reportId);
    }

    const changes: {
      -readonly [K in keyof UpdateReportDefinitionChanges]: UpdateReportDefinitionChanges[K];
    } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.name !== undefined && input.name !== current.name) {
      changes.name = input.name;
      previousValues.name = current.name;
      newValues.name = input.name;
    }

    if (input.description !== undefined && input.description !== current.description) {
      changes.description = input.description;
      previousValues.description = current.description;
      newValues.description = input.description;
    }

    if (input.metricKeys !== undefined) {
      const metricKeys = assertValidReportMetricKeys(input.metricKeys);
      if (!arraysEqual(metricKeys, current.metricKeys)) {
        changes.metricKeys = metricKeys;
        previousValues.metricKeys = current.metricKeys;
        newValues.metricKeys = metricKeys;
      }
    }

    if (input.isActive !== undefined && input.isActive !== current.isActive) {
      changes.isActive = input.isActive;
      previousValues.isActive = current.isActive;
      newValues.isActive = input.isActive;
    }

    const createdBy = await resolveReportCreatedByRef(this.referenceData, current.createdByUserId);

    if (Object.keys(changes).length === 0) {
      return { record: current, createdBy };
    }

    const record = await this.transactionRunner.run(async () => {
      const updated = await this.definitionRepository.update(input.reportId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.reports.entityLabel, input.reportId);
      }

      await this.auditRecorder.record({
        action: 'report.updated',
        entityType: AuditEntityType.REPORT,
        entityId: input.reportId,
        actorLabel: actor.fullName,
        previousValues,
        newValues,
      });

      return updated;
    });

    return { record, createdBy };
  }
}
