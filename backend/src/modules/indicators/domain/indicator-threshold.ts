import type { IndicatorThresholdComparator } from '@prisma/client';

export function evaluateThresholdBreach(
  comparator: IndicatorThresholdComparator | null,
  value: number,
  thresholdValue: number | null,
): boolean {
  if (comparator === null || thresholdValue === null) {
    return false;
  }

  switch (comparator) {
    case 'GTE':
      return value >= thresholdValue;
    case 'GT':
      return value > thresholdValue;
    case 'LTE':
      return value <= thresholdValue;
    case 'LT':
      return value < thresholdValue;
    default: {
      const exhaustiveCheck: never = comparator;
      throw new Error(
        `evaluateThresholdBreach: unhandled IndicatorThresholdComparator "${String(exhaustiveCheck)}".`,
      );
    }
  }
}
