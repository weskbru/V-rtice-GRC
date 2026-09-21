/**
 * 009-indicators-reports, Fase 8 (T068 prep) — `metricKeys` non-emptiness
 * (data-model.md §1) + closed `IndicatorMetricKey` membership (FR-022),
 * extracted from `CreateReportDefinitionUseCase`'s own private method
 * (unchanged in behavior) the first time a SECOND caller
 * (`UpdateReportDefinitionUseCase`) needed the identical rule — the same
 * "one validator, never a second copy" reasoning
 * `assert-indicator-threshold-invariant.ts` documents for its own module
 * (CLAUDE.md §19.7).
 *
 * Checked against `Object.values(IndicatorMetricKey)` — the Prisma-
 * GENERATED enum, VALUE-imported here — rather than against
 * `modules/indicators/domain/indicator-metric-catalog.ts`'s own
 * `isIndicatorMetricKey`: a business module may not import another
 * business module's domain layer directly (`apps/api/eslint.config.mjs`'s
 * module-isolation policy). See `CreateReportDefinitionUseCase`'s own
 * (former) header for the full reasoning this file does not repeat.
 */
import { IndicatorMetricKey } from '@prisma/client';

import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

const KNOWN_METRIC_KEYS: ReadonlySet<string> = new Set(Object.values(IndicatorMetricKey));

/** Both checks run over the WHOLE array before throwing, so a caller
 * supplying several unknown keys sees every offending index at once,
 * rather than fixing one at a time. */
export function assertValidReportMetricKeys(
  metricKeys: readonly string[],
): readonly IndicatorMetricKey[] {
  if (metricKeys.length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.reports.metricKeysEmpty, [
      { field: 'metricKeys', message: USER_MESSAGES.reports.metricKeysEmpty },
    ]);
  }

  const errors = metricKeys
    .map((metricKey, index) => ({ metricKey, index }))
    .filter(({ metricKey }) => !KNOWN_METRIC_KEYS.has(metricKey))
    .map(({ metricKey, index }) => ({
      field: `metricKeys[${String(index)}]`,
      message: USER_MESSAGES.reports.unknownMetricKey(metricKey),
    }));

  if (errors.length > 0) {
    throw new ValidationDomainError(errors[0]!.message, errors);
  }

  return metricKeys as readonly IndicatorMetricKey[];
}
