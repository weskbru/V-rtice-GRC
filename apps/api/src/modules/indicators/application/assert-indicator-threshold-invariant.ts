/**
 * 009-indicators-reports, Fase 8 (T068 prep) — Invariant T1 (data-model.md
 * §1): `thresholdComparator`/`thresholdValue` must be populated together,
 * or neither. Single shared check, reused by BOTH
 * `CreateIndicatorDefinitionUseCase` and the later `UpdateIndicatorDefinitionUseCase`
 * (CLAUDE.md §19.7 — one validator, never a second copy) — this function
 * was originally a private method on `CreateIndicatorDefinitionUseCase`
 * itself; extracted here, unchanged in behavior, the first time a SECOND
 * caller needed the same rule.
 *
 * Both callers resolve their OWN final pair before calling this: `create`
 * normalizes `input.thresholdComparator ?? null`/`input.thresholdValue ??
 * null` (a create request has no "current row" to merge against); `update`
 * merges the incoming PATCH against the persisted row first (`input.field
 * !== undefined ? input.field : current.field`). This function therefore
 * only ever sees the FINAL, post-merge state a record would have, never a
 * raw partial PATCH body — the same "resolve then validate" division of
 * labor `UpdateControlUseCase`'s own field-by-field diff already follows
 * for its own fields.
 */
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
