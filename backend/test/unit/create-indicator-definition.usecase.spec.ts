import { AuditEntityType, IndicatorMetricKey } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { CreateIndicatorDefinitionUseCase } from '../../src/modules/indicators/application/create-indicator-definition.usecase';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../src/shared/errors/domain-error';

import type { AuditRecorder } from '../../src/core/audit/application/audit-recorder.service';
import type { EntityCodeGeneratorPort } from '../../src/grc/shared/domain/ports/entity-code-generator.port';
import type { IndicatorDefinitionRepositoryPort } from '../../src/modules/indicators/domain/ports/indicator-definition-repository.port';
import type { IndicatorReferenceDataPort } from '../../src/modules/indicators/domain/ports/indicator-reference-data.port';
import type { TransactionRunnerPort } from '../../src/shared/persistence/transaction-runner.port';

const ACTOR = { id: 'actor-1', isActive: true, fullName: 'Ana Auditora' };
const OWNER = { id: 'owner-1', isActive: true, fullName: 'Ozéias Owner' };

function buildUseCase(overrides?: {
  readonly created?: unknown;
  readonly existingDefinition?: unknown;
  readonly ownerLookup?: unknown;
}): {
  useCase: CreateIndicatorDefinitionUseCase;
  repository: {
    create: ReturnType<typeof vi.fn>;
    findByMetricKey: ReturnType<typeof vi.fn>;
  };
  referenceData: { findUser: ReturnType<typeof vi.fn> };
  auditRecorder: { record: ReturnType<typeof vi.fn> };
  codeGenerator: { nextCode: ReturnType<typeof vi.fn> };
} {
  const created = overrides?.created ?? {
    id: 'indicator-1',
    code: 'IND-2026-0001',
    metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
    name: 'Indicador de teste',
    description: 'Descrição',
    ownerUserId: OWNER.id,
    thresholdComparator: null,
    thresholdValue: null,
    isActive: true,
    createdByUserId: ACTOR.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const findByMetricKey = vi.fn().mockResolvedValue(overrides?.existingDefinition ?? undefined);
  const repositoryCreate = vi.fn().mockResolvedValue(created);
  const repository = {
    findById: vi.fn(),
    findByMetricKey,
    list: vi.fn(),
    create: repositoryCreate,
    update: vi.fn(),
    listConfiguredMetricKeys: vi.fn(),
    listAllIds: vi.fn(),
  } as unknown as IndicatorDefinitionRepositoryPort;

  const findUser = vi.fn().mockImplementation((id: string) => {
    if (id === ACTOR.id) {
      return Promise.resolve(ACTOR);
    }
    if (id === OWNER.id) {
      return Promise.resolve(overrides?.ownerLookup ?? OWNER);
    }
    return Promise.resolve(undefined);
  });
  const referenceData = {
    findUser,
    findUserOrgUnitId: vi.fn(),
  } as unknown as IndicatorReferenceDataPort;

  const nextCode = vi.fn().mockResolvedValue('IND-2026-0001');
  const codeGenerator = { nextCode } as unknown as EntityCodeGeneratorPort;

  const auditRecord = vi.fn().mockResolvedValue(undefined);
  const auditRecorder = { record: auditRecord } as unknown as AuditRecorder;

  const transactionRunner = {
    run: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
  } as unknown as TransactionRunnerPort;

  const useCase = new CreateIndicatorDefinitionUseCase(
    transactionRunner,
    repository,
    referenceData,
    codeGenerator,
    auditRecorder,
  );

  return {
    useCase,
    repository: { create: repositoryCreate, findByMetricKey },
    referenceData: { findUser },
    auditRecorder: { record: auditRecord },
    codeGenerator: { nextCode },
  };
}

describe('CreateIndicatorDefinitionUseCase', () => {
  it('rejects an unknown metricKey, without reaching the repository', async () => {
    const { useCase, repository } = buildUseCase();

    const error = await useCase
      .execute({
        actorUserId: ACTOR.id,
        metricKey: 'NOT_A_REAL_METRIC_KEY',
        name: 'Indicador inválido',
        description: 'Chave inexistente',
        ownerUserId: OWNER.id,
      })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ValidationDomainError);
    expect((error as ValidationDomainError).errors).toEqual([
      expect.objectContaining({ field: 'metricKey' }),
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects thresholdComparator supplied without thresholdValue (Invariant T1)', async () => {
    const { useCase, repository } = buildUseCase();

    const error = await useCase
      .execute({
        actorUserId: ACTOR.id,
        metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
        name: 'Indicador com limiar incompleto',
        description: 'Comparador sem valor',
        ownerUserId: OWNER.id,
        thresholdComparator: 'GTE',
      })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ValidationDomainError);
    expect((error as ValidationDomainError).errors).toEqual([
      expect.objectContaining({ field: 'thresholdValue' }),
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects thresholdValue supplied without thresholdComparator (Invariant T1)', async () => {
    const { useCase, repository } = buildUseCase();

    const error = await useCase
      .execute({
        actorUserId: ACTOR.id,
        metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
        name: 'Indicador com limiar incompleto',
        description: 'Valor sem comparador',
        ownerUserId: OWNER.id,
        thresholdValue: 10,
      })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ValidationDomainError);
    expect((error as ValidationDomainError).errors).toEqual([
      expect.objectContaining({ field: 'thresholdComparator' }),
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('accepts thresholdComparator and thresholdValue supplied together', async () => {
    const { useCase, repository } = buildUseCase();

    await useCase.execute({
      actorUserId: ACTOR.id,
      metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
      name: 'Indicador com limiar completo',
      description: 'Comparador e valor juntos',
      ownerUserId: OWNER.id,
      thresholdComparator: 'GTE',
      thresholdValue: 10,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        thresholdComparator: 'GTE',
        thresholdValue: 10,
      }),
    );
  });

  it('rejects a metricKey that already has a configured definition, without reaching the repository', async () => {
    const { useCase, repository } = buildUseCase({
      existingDefinition: {
        id: 'existing-1',
        metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
      },
    });

    const error = await useCase
      .execute({
        actorUserId: ACTOR.id,
        metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
        name: 'Indicador duplicado',
        description: 'Chave já configurada',
        ownerUserId: OWNER.id,
      })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ValidationDomainError);
    expect((error as ValidationDomainError).errors).toEqual([
      expect.objectContaining({ field: 'metricKey' }),
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects an ownerUserId that does not resolve to any user', async () => {
    const { useCase, repository } = buildUseCase();

    const error = await useCase
      .execute({
        actorUserId: ACTOR.id,
        metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
        name: 'Indicador sem dono válido',
        description: 'Owner inexistente',
        ownerUserId: 'ghost-owner',
      })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ValidationDomainError);
    expect((error as ValidationDomainError).errors).toEqual([
      expect.objectContaining({ field: 'ownerUserId' }),
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects an ownerUserId that resolves to an inactive user', async () => {
    const { useCase, repository } = buildUseCase({
      ownerLookup: { ...OWNER, isActive: false },
    });

    const error = await useCase
      .execute({
        actorUserId: ACTOR.id,
        metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
        name: 'Indicador com dono inativo',
        description: 'Owner inativo',
        ownerUserId: OWNER.id,
      })
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ValidationDomainError);
    expect((error as ValidationDomainError).errors).toEqual([
      expect.objectContaining({ field: 'ownerUserId' }),
    ]);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedDomainError when the actor cannot be resolved', async () => {
    const { useCase } = buildUseCase();
    const referenceData = {
      findUser: vi.fn().mockResolvedValue(undefined),
      findUserOrgUnitId: vi.fn(),
    };
    const brokenUseCase = new CreateIndicatorDefinitionUseCase(
      { run: vi.fn() },
      { create: vi.fn(), findByMetricKey: vi.fn() } as unknown as IndicatorDefinitionRepositoryPort,
      referenceData,
      { nextCode: vi.fn() },
      { record: vi.fn() } as unknown as AuditRecorder,
    );

    await expect(
      brokenUseCase.execute({
        actorUserId: 'ghost',
        metricKey: IndicatorMetricKey.RISK_TOTAL_BY_LEVEL,
        name: 'x',
        description: 'y',
        ownerUserId: OWNER.id,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedDomainError);
    expect(useCase).toBeDefined();
  });

  it('allocates an IND code, persists the definition and audits the creation', async () => {
    const { useCase, repository, auditRecorder, codeGenerator } = buildUseCase();

    const result = await useCase.execute({
      actorUserId: ACTOR.id,
      metricKey: IndicatorMetricKey.CONTROL_INACTIVE_COUNT,
      name: 'Controles inativos',
      description: 'Indicador de controles inativos',
      ownerUserId: OWNER.id,
    });

    expect(codeGenerator.nextCode).toHaveBeenCalledWith('IND', expect.any(Number));
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'IND-2026-0001',
        metricKey: IndicatorMetricKey.CONTROL_INACTIVE_COUNT,
        name: 'Controles inativos',
        description: 'Indicador de controles inativos',
        ownerUserId: OWNER.id,
        thresholdComparator: null,
        thresholdValue: null,
        createdByUserId: ACTOR.id,
      }),
    );
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'indicator.created',
        entityType: AuditEntityType.INDICATOR,
        actorLabel: ACTOR.fullName,
      }),
    );
    expect(result.owner).toEqual({ id: OWNER.id, fullName: OWNER.fullName });
  });
});
