/**
 * 009-indicators-reports, Fase 7 (T051) — unit tests for
 * `CreateReportDefinitionUseCase`. Every port is a hand-rolled fake
 * (`as unknown as <Port>`), the same convention
 * `indicator-calculation-service.spec.ts`/`get-dashboard-planned-areas.spec.ts`
 * already use — no NestJS test module, no Prisma connection.
 *
 * Covers this task's own scope: `metricKeys` validation (non-empty, closed
 * `IndicatorMetricKey` catalog membership) and the creation/audit happy
 * path. Contract/integration coverage (the HTTP route, the DTO's own
 * `400`) is T054/T055's scope, not this one's.
 */
import { AuditEntityType, IndicatorMetricKey } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { CreateReportDefinitionUseCase } from '../../src/modules/reports/application/create-report-definition.usecase';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../src/shared/errors/domain-error';

import type { AuditRecorder } from '../../src/core/audit/application/audit-recorder.service';
import type { EntityCodeGeneratorPort } from '../../src/grc/shared/domain/ports/entity-code-generator.port';
import type { ReportDefinitionRepositoryPort } from '../../src/modules/reports/domain/ports/report-definition-repository.port';
import type { ReportReferenceDataPort } from '../../src/modules/reports/domain/ports/report-reference-data.port';
import type { TransactionRunnerPort } from '../../src/shared/persistence/transaction-runner.port';

const ACTOR = { id: 'actor-1', isActive: true, fullName: 'Ana Auditora' };

function buildUseCase(overrides?: { readonly created?: unknown }): {
  useCase: CreateReportDefinitionUseCase;
  repository: { create: ReturnType<typeof vi.fn> };
  auditRecorder: { record: ReturnType<typeof vi.fn> };
  codeGenerator: { nextCode: ReturnType<typeof vi.fn> };
} {
  const created = overrides?.created ?? {
    id: 'report-1',
    code: 'RPT-2026-0001',
    name: 'Relatório de teste',
    description: 'Descrição',
    metricKeys: [IndicatorMetricKey.RISK_TOTAL_BY_LEVEL],
    isActive: true,
    createdByUserId: ACTOR.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const repositoryCreate = vi.fn().mockResolvedValue(created);
  const repository = {
    findById: vi.fn(),
    list: vi.fn(),
    create: repositoryCreate,
  } as unknown as ReportDefinitionRepositoryPort;

  const referenceData = {
    findUser: vi.fn().mockResolvedValue(ACTOR),
  } as unknown as ReportReferenceDataPort;

  const nextCode = vi.fn().mockResolvedValue('RPT-2026-0001');
  const codeGenerator = { nextCode } as unknown as EntityCodeGeneratorPort;

  const auditRecord = vi.fn().mockResolvedValue(undefined);
  const auditRecorder = { record: auditRecord } as unknown as AuditRecorder;

  const transactionRunner = {
    run: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
  } as unknown as TransactionRunnerPort;

  const useCase = new CreateReportDefinitionUseCase(
    transactionRunner,
    repository,
    referenceData,
    codeGenerator,
    auditRecorder,
  );

  return {
    useCase,
    repository: { create: repositoryCreate },
    auditRecorder: { record: auditRecord },
    codeGenerator: { nextCode },
  };
}

describe('CreateReportDefinitionUseCase', () => {
  it('rejects an empty metricKeys array without reaching the repository', async () => {
    const { useCase, repository } = buildUseCase();

    await expect(
      useCase.execute({
        actorUserId: ACTOR.id,
        name: 'Relatório vazio',
        description: 'Sem métricas',
        metricKeys: [],
      }),
    ).rejects.toBeInstanceOf(ValidationDomainError);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a metricKeys array containing an unknown catalog key, without reaching the repository', async () => {
    const { useCase, repository } = buildUseCase();

    const error = await useCase
      .execute({
        actorUserId: ACTOR.id,
        name: 'Relatório inválido',
        description: 'Chave inexistente',
        metricKeys: [IndicatorMetricKey.RISK_TOTAL_BY_LEVEL, 'NOT_A_REAL_METRIC_KEY'],
      })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ValidationDomainError);
    expect((error as ValidationDomainError).errors).toEqual([
      expect.objectContaining({ field: 'metricKeys[1]' }),
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('reports every unknown key at once, not only the first', async () => {
    const { useCase } = buildUseCase();

    const error = await useCase
      .execute({
        actorUserId: ACTOR.id,
        name: 'Relatório com duas chaves inválidas',
        description: 'Duas chaves inexistentes',
        metricKeys: ['UNKNOWN_ONE', 'UNKNOWN_TWO'],
      })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ValidationDomainError);
    expect((error as ValidationDomainError).errors.map((fieldError) => fieldError.field)).toEqual([
      'metricKeys[0]',
      'metricKeys[1]',
    ]);
  });

  it('throws UnauthorizedDomainError when the actor cannot be resolved', async () => {
    const { useCase } = buildUseCase();
    const referenceData = { findUser: vi.fn().mockResolvedValue(undefined) };
    const brokenUseCase = new CreateReportDefinitionUseCase(
      { run: vi.fn() },
      { create: vi.fn() } as unknown as ReportDefinitionRepositoryPort,
      referenceData,
      { nextCode: vi.fn() },
      { record: vi.fn() } as unknown as AuditRecorder,
    );

    await expect(
      brokenUseCase.execute({
        actorUserId: 'ghost',
        name: 'x',
        description: 'y',
        metricKeys: [IndicatorMetricKey.RISK_TOTAL_BY_LEVEL],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedDomainError);
    // Not touched here on purpose — `useCase` is unused otherwise.
    expect(useCase).toBeDefined();
  });

  it('allocates an RPT code, persists the definition and audits the creation', async () => {
    const { useCase, repository, auditRecorder, codeGenerator } = buildUseCase();

    const result = await useCase.execute({
      actorUserId: ACTOR.id,
      name: 'Painel executivo',
      description: 'Riscos e controles',
      metricKeys: [
        IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
        IndicatorMetricKey.CONTROL_INACTIVE_COUNT,
      ],
    });

    expect(codeGenerator.nextCode).toHaveBeenCalledWith('RPT', expect.any(Number));
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'RPT-2026-0001',
        name: 'Painel executivo',
        description: 'Riscos e controles',
        metricKeys: [
          IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
          IndicatorMetricKey.CONTROL_INACTIVE_COUNT,
        ],
        createdByUserId: ACTOR.id,
      }),
    );
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'report.created',
        entityType: AuditEntityType.REPORT,
        actorLabel: ACTOR.fullName,
      }),
    );
    expect(result.createdBy).toEqual(ACTOR);
  });
});
