import { IndicatorMetricKey } from '@prisma/client';

import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

const KNOWN_METRIC_KEYS: ReadonlySet<string> = new Set(Object.values(IndicatorMetricKey));

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
