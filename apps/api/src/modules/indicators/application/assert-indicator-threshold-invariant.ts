import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { IndicatorThresholdComparator } from '@prisma/client';

export function assertIndicatorThresholdInvariant(
  comparator: IndicatorThresholdComparator | null,
  value: number | null,
): void {
  const hasComparator = comparator !== null;
  const hasValue = value !== null;
  if (hasComparator === hasValue) {
    return;
  }
  throw new ValidationDomainError(USER_MESSAGES.indicators.thresholdRequiresBothFields, [
    {
      field: hasComparator ? 'thresholdValue' : 'thresholdComparator',
      message: USER_MESSAGES.indicators.thresholdRequiresBothFields,
    },
  ]);
}
