/**
 * 009-indicators-reports, Fase 5 (T039-T042) — unit coverage for the
 * threshold-breach notification `CreateIndicatorMeasurementUseCase` now
 * produces (spec.md FR-017/FR-019, research.md D-7, CLAUDE.md §19.10).
 *
 * Every port is a hand-rolled fake (`as unknown as <Port>`), the same
 * convention `run-report.usecase.spec.ts`/`indicator-calculation-service.
 * spec.ts` already use — no NestJS test module, no database. The
 * database-backed proof that a NOTIFICATION ROW is actually written
 * belongs to `test/integration/indicator-measurement-notifications.spec.ts`
 * (T039/T040); this file's job is the WIRING: does the use case call
 * `NotificationService.notify` exactly when `breached` is `true`, with the
 * right recipient, deep link and message — and never otherwise.
 *
 * The fake `IndicatorCalculationService.calculate` below does not
 * hand-compute `breached` as a literal `true`/`false` per test case; it
 * calls the REAL `evaluateThresholdBreach` (T013, already exhaustively
 * unit-tested on its own) against whatever `definition`/`value` this
 * file's test supplies — the same call the real service makes internally.
 * This is what lets the four-comparator/equality-boundary tests below
 * exercise genuine comparator arithmetic through this use case's own
 * code path, without silently duplicating (or diverging from)
 * `indicator-threshold.spec.ts`'s own coverage.
 */
import { describe, expect, it, vi } from 'vitest';

import { CreateIndicatorMeasurementUseCase } from '../../src/modules/indicators/application/create-indicator-measurement.usecase';
import { evaluateThresholdBreach } from '../../src/modules/indicators/domain/indicator-threshold';
import { USER_MESSAGES } from '../../src/shared/messages/user-messages';

import type { AuditRecorder } from '../../src/core/audit/application/audit-recorder.service';
import type { NotificationService } from '../../src/core/notifications/application/notification.service';
import type { ScopeResolverService } from '../../src/core/organizations/application/scope-resolver.service';
import type { IndicatorCalculationService } from '../../src/modules/indicators/application/indicator-calculation.service';
import type { IndicatorDefinitionRecord } from '../../src/modules/indicators/domain/indicator-definition.entity';
import type { IndicatorDefinitionRepositoryPort } from '../../src/modules/indicators/domain/ports/indicator-definition-repository.port';
import type { IndicatorMeasurementRepositoryPort } from '../../src/modules/indicators/domain/ports/indicator-measurement-repository.port';
import type { IndicatorReferenceDataPort } from '../../src/modules/indicators/domain/ports/indicator-reference-data.port';
import type { TransactionRunnerPort } from '../../src/shared/persistence/transaction-runner.port';
import type { IndicatorThresholdComparator } from '@prisma/client';

const GLOBAL_SCOPE = { kind: 'GLOBAL' as const };
const ACTOR = { id: 'actor-1', isActive: true, fullName: 'Responsável de Teste' };
const OWNER_USER_ID = 'owner-1';

function buildDefinition(
  overrides: Partial<IndicatorDefinitionRecord> = {},
): IndicatorDefinitionRecord {
  return {
    id: 'def-1',
    code: 'IND-2026-0001',
    metricKey: 'ASSET_INACTIVE_COUNT',
    name: 'Ativos inativos',
    description: 'Descrição.',
    ownerUserId: OWNER_USER_ID,
    thresholdComparator: null,
    thresholdValue: null,
    isActive: true,
    createdByUserId: OWNER_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildUseCase(options: {
  readonly definition: IndicatorDefinitionRecord | undefined;
  readonly computedValue: number;
}): {
  useCase: CreateIndicatorMeasurementUseCase;
  notify: ReturnType<typeof vi.fn>;
  calculate: ReturnType<typeof vi.fn>;
} {
  const transactionRunner = {
    run: vi.fn().mockImplementation((fn: () => unknown) => fn()),
  } as unknown as TransactionRunnerPort;

  const definitionRepository = {
    findByMetricKey: vi.fn().mockResolvedValue(options.definition),
  } as unknown as IndicatorDefinitionRepositoryPort;

  let nextId = 0;
  const measurementRepository = {
    create: vi.fn().mockImplementation((input: Record<string, unknown>) => {
      nextId += 1;
      return Promise.resolve({
        id: `measurement-${nextId}`,
        computedAt: new Date(),
        ...input,
      });
    }),
  } as unknown as IndicatorMeasurementRepositoryPort;

  const referenceData = {
    findUser: vi.fn().mockResolvedValue(ACTOR),
  } as unknown as IndicatorReferenceDataPort;

  // Mirrors `IndicatorCalculationService.calculate`'s own FR-016 shape
  // (`indicator-calculation.service.ts`'s own header): evaluate the REAL
  // threshold function against whatever definition was resolved, in the
  // same call that produces the value.
  const calculate = vi
    .fn()
    .mockImplementation((input: { definition: IndicatorDefinitionRecord | undefined }) =>
      Promise.resolve({
        metricKey: 'ASSET_INACTIVE_COUNT',
        scopeApplicability: 'ORGANIZATIONAL_UNIT',
        shape: 'SINGLE_VALUE',
        value: options.computedValue,
        valueByBucket: undefined,
        breached: evaluateThresholdBreach(
          input.definition?.thresholdComparator ?? null,
          options.computedValue,
          input.definition?.thresholdValue ?? null,
        ),
      }),
    );
  const calculationService = { calculate } as unknown as IndicatorCalculationService;

  const scopeResolver = {
    resolveScope: vi.fn().mockResolvedValue(GLOBAL_SCOPE),
  } as unknown as ScopeResolverService;

  const auditRecorder = {
    record: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditRecorder;

  const notify = vi.fn().mockResolvedValue({});
  const notificationService = { notify } as unknown as NotificationService;

  const useCase = new CreateIndicatorMeasurementUseCase(
    transactionRunner,
    definitionRepository,
    measurementRepository,
    referenceData,
    calculationService,
    scopeResolver,
    auditRecorder,
    notificationService,
  );

  return { useCase, notify, calculate };
}

describe('CreateIndicatorMeasurementUseCase — threshold-breach notification (T039-T042)', () => {
  it('T041: an IndicatorDefinition with no threshold configured never breaches and never notifies, end-to-end through the creation path', async () => {
    const definition = buildDefinition({ thresholdComparator: null, thresholdValue: null });
    const { useCase, notify } = buildUseCase({ definition, computedValue: 999 });

    const result = await useCase.execute({
      actorUserId: ACTOR.id,
      metricKey: 'ASSET_INACTIVE_COUNT',
    });

    expect(result.record.breached).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });

  it('a metric key with no IndicatorDefinition at all never breaches and never notifies (no crash on undefined definition)', async () => {
    const { useCase, notify, calculate } = buildUseCase({
      definition: undefined,
      computedValue: 42,
    });

    const result = await useCase.execute({
      actorUserId: ACTOR.id,
      metricKey: 'ASSET_INACTIVE_COUNT',
    });

    expect(result.record.breached).toBe(false);
    expect(notify).not.toHaveBeenCalled();
    // Forwarded as `undefined`, never a fabricated definition — this is
    // what makes `evaluateThresholdBreach`'s own "no threshold configured"
    // branch (comparator === null) the path actually taken.
    expect(calculate).toHaveBeenCalledWith(expect.objectContaining({ definition: undefined }));
  });

  describe.each<{
    comparator: IndicatorThresholdComparator;
    thresholdValue: number;
    boundaryValue: number;
    expectedBreach: boolean;
  }>([
    { comparator: 'GTE', thresholdValue: 5, boundaryValue: 5, expectedBreach: true },
    { comparator: 'GT', thresholdValue: 5, boundaryValue: 5, expectedBreach: false },
    { comparator: 'LTE', thresholdValue: 5, boundaryValue: 5, expectedBreach: true },
    { comparator: 'LT', thresholdValue: 5, boundaryValue: 5, expectedBreach: false },
  ])(
    '$comparator at the exact equality boundary (value === thresholdValue)',
    ({ comparator, thresholdValue, boundaryValue, expectedBreach }) => {
      it(`persists breached=${expectedBreach} and ${expectedBreach ? 'notifies exactly once' : 'never notifies'}`, async () => {
        const definition = buildDefinition({
          thresholdComparator: comparator,
          thresholdValue,
        });
        const { useCase, notify } = buildUseCase({ definition, computedValue: boundaryValue });

        const result = await useCase.execute({
          actorUserId: ACTOR.id,
          metricKey: 'ASSET_INACTIVE_COUNT',
        });

        expect(result.record.breached).toBe(expectedBreach);
        if (expectedBreach) {
          expect(notify).toHaveBeenCalledTimes(1);
        } else {
          expect(notify).not.toHaveBeenCalled();
        }
      });
    },
  );

  it('T039/FR-017: a breached measurement notifies exactly once, addressed to the definition owner, never the acting user', async () => {
    const definition = buildDefinition({
      ownerUserId: OWNER_USER_ID,
      thresholdComparator: 'GTE',
      thresholdValue: 5,
    });
    const { useCase, notify } = buildUseCase({ definition, computedValue: 7 });

    await useCase.execute({ actorUserId: ACTOR.id, metricKey: 'ASSET_INACTIVE_COUNT' });

    expect(notify).toHaveBeenCalledTimes(1);
    const call = notify.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.recipientUserId).toBe(OWNER_USER_ID);
    expect(call.recipientUserId).not.toBe(ACTOR.id);
  });

  it('T042: the notification carries the FR-018 deep link (CommentableEntityType.INDICATOR + the definition id) and a title/body naming the indicator and the calculated value', async () => {
    const definition = buildDefinition({
      id: 'def-deep-link',
      name: 'Ativos inativos críticos',
      thresholdComparator: 'GTE',
      thresholdValue: 5,
    });
    const { useCase, notify } = buildUseCase({ definition, computedValue: 7 });

    await useCase.execute({ actorUserId: ACTOR.id, metricKey: 'ASSET_INACTIVE_COUNT' });

    expect(notify).toHaveBeenCalledTimes(1);
    const call = notify.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.entityType).toBe('INDICATOR');
    expect(call.entityId).toBe('def-deep-link');
    expect(call.title).toBe(
      USER_MESSAGES.indicators.thresholdBreachedTitle('Ativos inativos críticos'),
    );
    expect(call.body).toBe(
      USER_MESSAGES.indicators.thresholdBreachedBody('Ativos inativos críticos', '7'),
    );
    expect(String(call.body)).toContain('Ativos inativos críticos');
    expect(String(call.body)).toContain('7');
  });

  it('a value that does not breach the configured threshold produces zero notifications', async () => {
    const definition = buildDefinition({ thresholdComparator: 'GTE', thresholdValue: 5 });
    const { useCase, notify } = buildUseCase({ definition, computedValue: 3 });

    const result = await useCase.execute({
      actorUserId: ACTOR.id,
      metricKey: 'ASSET_INACTIVE_COUNT',
    });

    expect(result.record.breached).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
});
