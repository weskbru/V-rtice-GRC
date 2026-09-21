/**
 * 009-indicators-reports, Fase 4 (T035) — `CreateIndicatorMeasurementUseCase`
 * (`createIndicatorMeasurement`, spec.md FR-011/FR-012/FR-016, data-model.md
 * §2, research.md D-6/D-7). Records exactly one immutable historical point
 * for a metric key.
 *
 * ## Order of checks — the scope gate runs BEFORE anything else
 *
 * `indicator:edit` is enforced by `PermissionGuard`/`@RequirePermission` on
 * `IndicatorController#createMeasurement`, before this use case's `execute`
 * ever runs. This use case is responsible for the rest of FR-012
 * (research.md D-6): the caller's resolved `ScopeFilter` must be
 * `{ kind: 'GLOBAL' }`.
 *
 * That check is the FIRST thing this method does — before the `metricKey`
 * is even validated against the catalog, before any user lookup, and
 * therefore strictly before `IndicatorCalculationService.calculate` could
 * ever read a single source-domain row. This is not merely "checked early"
 * as an optimization: it is what `research.md` D-6 and
 * `contracts/indicators.openapi.yaml` both require in words ("refused with
 * `403` before any source table is read") — the calculation is never
 * performed and then discarded on a scope failure. A caller with `UNIT`
 * scope gets `403` with no side effect of any kind, not even a catalog
 * lookup.
 *
 * ## Never a second calculator (CLAUDE.md §19.7)
 *
 * The value, `valueByBucket` and `breached` are all produced by ONE call to
 * `IndicatorCalculationService.calculate` (T029) — the exact same service
 * `GetIndicatorCurrentValueUseCase` (US1) and the future `RunReportUseCase`
 * (US5) call. `breached` is persisted exactly as calculated at this instant
 * and is never recomputed afterward (research.md D-7,
 * `indicator_measurements.breached`'s own schema comment).
 *
 * ## Invariant M1
 *
 * `value`/`valueByBucket` are written exactly as
 * `IndicatorCalculationResult` already produces them — that result type
 * itself guarantees only one of the two is ever populated (its own header),
 * so this use case does not re-derive or re-check the invariant; it simply
 * forwards it to `IndicatorMeasurementRepositoryPort.create`.
 *
 * ## Fase 5 (T039-T042) — the threshold-breach notification (FR-017/D-7,
 * first real producer of `NotificationService`, CLAUDE.md §19.10)
 *
 * When `created.breached` is `true`, `NotificationService.notify` is
 * called exactly once, addressed to `definitionRecord!.ownerUserId` — the
 * `!` is safe, not merely convenient: `breached` can only be `true` when
 * `IndicatorCalculationService.calculate` was given a non-null
 * `definition` (`evaluateThresholdBreach` returns `false` unconditionally
 * for `comparator === null`, this file's own T029 dependency), so
 * `breached === true` is itself the proof `definitionRecord` is defined
 * here — never re-checked with a second `if`, since a second check could
 * silently diverge from that guarantee later without either test failing
 * loudly.
 *
 * The call sits INSIDE the same `transactionRunner.run` block as the
 * measurement and the audit entry, immediately after both. Not because a
 * notification must be transactionally atomic with the business event —
 * `NotificationService`'s own header is explicit that it need not be, and
 * deliberately does not open its own transaction — but because placing it
 * here means it rides whatever transaction boundary this use case already
 * opened for its own reasons (via `PrismaService.client`'s ambient-
 * transaction lookup, the same mechanism the header describes): if the
 * transaction is ever rolled back for an unrelated reason, no orphaned
 * notification survives pointing at a measurement that was never actually
 * committed. This is a property of where the call is placed, not a new
 * requirement invented for the notification itself.
 *
 * ## Non-disclosure (`NotificationService`'s own documented producer
 * obligation — it does not and cannot verify visibility itself)
 *
 * The recipient here is `IndicatorDefinition.ownerUserId` — the same field
 * `CreateIndicatorDefinitionUseCase` already validates exists and is
 * active before a definition can even be created. This is legitimate
 * specifically BECAUSE `ownerUserId` denotes, by construction, the one
 * person the platform already treats as answering for this indicator
 * (data-model.md §1: "responsável"), not because that person separately
 * holds `indicator:view` at notification time — the same shape
 * `NotificationService`'s header names as its own worked example ("the
 * analyst who requested an approval is inherently authorized about their
 * own request"). Being named as the record's own owner is what makes a
 * notification about THAT record inherently theirs to receive; it is not
 * a permission grant being checked, and this use case does not perform
 * one, exactly as none of `CreateIndicatorDefinitionUseCase`'s own
 * `ownerUserId` validation checks `indicator:view` either.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { NotificationService } from '../../../core/notifications/application/notification.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  ForbiddenDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { findIndicatorMetricCatalogEntry } from '../domain/indicator-metric-catalog';
import { IndicatorDefinitionRepositoryPort } from '../domain/ports/indicator-definition-repository.port';
import { IndicatorMeasurementRepositoryPort } from '../domain/ports/indicator-measurement-repository.port';
import { IndicatorReferenceDataPort } from '../domain/ports/indicator-reference-data.port';

import { IndicatorCalculationService } from './indicator-calculation.service';

import type { IndicatorOwnerRef } from './resolve-indicator-owner';
import type { IndicatorMeasurementRecord } from '../domain/indicator-measurement.entity';

export interface CreateIndicatorMeasurementInput {
  readonly actorUserId: string;
  /** Raw path segment — validated against the closed catalog INSIDE this
   * use case (FR-010's own "unknown key is 404" pattern, reused here),
   * hence `string`, not `IndicatorMetricKey`. */
  readonly metricKey: string;
}

export interface CreateIndicatorMeasurementResult {
  readonly record: IndicatorMeasurementRecord;
  readonly computedBy: IndicatorOwnerRef;
}

@Injectable()
export class CreateIndicatorMeasurementUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly definitionRepository: IndicatorDefinitionRepositoryPort,
    private readonly measurementRepository: IndicatorMeasurementRepositoryPort,
    private readonly referenceData: IndicatorReferenceDataPort,
    private readonly calculationService: IndicatorCalculationService,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(input: CreateIndicatorMeasurementInput): Promise<CreateIndicatorMeasurementResult> {
    // research.md D-6 — checked FIRST, before the catalog, before any user
    // lookup, before any source table read. See this file's own header.
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    if (scope.kind !== 'GLOBAL') {
      throw new ForbiddenDomainError(USER_MESSAGES.indicators.measurementRequiresGlobalScope);
    }

    const catalogEntry = findIndicatorMetricCatalogEntry(input.metricKey);
    if (!catalogEntry) {
      // FR-010's read-path shape, reused for this write path: the catalog
      // itself is the "record" being looked up.
      throw new NotFoundDomainError(USER_MESSAGES.indicators.metricKeyEntityLabel, input.metricKey);
    }

    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const definitionRecord = await this.definitionRepository.findByMetricKey(
      catalogEntry.metricKey,
    );

    const record = await this.transactionRunner.run(async () => {
      const result = await this.calculationService.calculate({
        metricKey: catalogEntry.metricKey,
        scope,
        definition: definitionRecord,
      });

      const created = await this.measurementRepository.create({
        metricKey: catalogEntry.metricKey,
        value: result.value ?? null,
        valueByBucket: result.valueByBucket ? { ...result.valueByBucket } : null,
        breached: result.breached,
        computedByUserId: input.actorUserId,
      });

      await this.auditRecorder.record({
        action: 'indicator_measurement.created',
        entityType: AuditEntityType.INDICATOR_MEASUREMENT,
        entityId: created.id,
        actorLabel: actor.fullName,
        newValues: {
          metricKey: created.metricKey,
          value: created.value,
          valueByBucket: created.valueByBucket,
          breached: created.breached,
          computedByUserId: created.computedByUserId,
        },
      });

      // Fase 5 (T039-T042, FR-017, research.md D-7) — the first real
      // producer `NotificationService` has ever had (CLAUDE.md §19.10).
      // `created.breached` can only be `true` when `definitionRecord` was
      // non-null (see this file's own header for why the `!` below is
      // safe, not merely convenient) — exactly one notification per
      // breached measurement, none when it did not breach, and none when
      // no `IndicatorDefinition` exists for the key at all.
      if (created.breached) {
        await this.notificationService.notify({
          recipientUserId: definitionRecord!.ownerUserId,
          type: 'indicator.threshold.breached',
          title: USER_MESSAGES.indicators.thresholdBreachedTitle(definitionRecord!.name),
          body: USER_MESSAGES.indicators.thresholdBreachedBody(
            definitionRecord!.name,
            String(created.value),
          ),
          entityType: 'INDICATOR',
          entityId: definitionRecord!.id,
        });
      }

      return created;
    });

    return {
      record,
      computedBy: { id: actor.id, fullName: actor.fullName },
    };
  }
}
