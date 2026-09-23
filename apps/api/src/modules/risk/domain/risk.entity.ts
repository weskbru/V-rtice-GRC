import {
  ValidationDomainError,
  type ValidationFieldError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { RiskStatus } from '@prisma/client';

const BUSINESS_CONTENT_LOCKED_STATUSES: ReadonlySet<RiskStatus> = new Set(['CLOSED', 'ARCHIVED']);

export function assertBusinessContentEditable(status: RiskStatus): void {
  if (BUSINESS_CONTENT_LOCKED_STATUSES.has(status)) {
    throw new ValidationDomainError(USER_MESSAGES.risk.businessContentLocked, [
      { field: 'status', message: USER_MESSAGES.risk.businessContentLocked },
    ]);
  }
}

export interface DraftCompletenessInput {
  readonly title: string | null | undefined;
  readonly description: string | null | undefined;
  readonly categoryId: string | null | undefined;
  readonly orgUnitId: string | null | undefined;
  readonly ownerUserId: string | null | undefined;
}

export function findDraftCompletenessGaps(
  input: DraftCompletenessInput,
): readonly ValidationFieldError[] {
  const errors: ValidationFieldError[] = [];

  if (!input.title || input.title.trim().length === 0) {
    errors.push({ field: 'title', message: USER_MESSAGES.risk.draftIncomplete.title });
  }
  if (!input.description || input.description.trim().length === 0) {
    errors.push({ field: 'description', message: USER_MESSAGES.risk.draftIncomplete.description });
  }
  if (!input.categoryId) {
    errors.push({ field: 'categoryId', message: USER_MESSAGES.risk.draftIncomplete.category });
  }
  if (!input.orgUnitId) {
    errors.push({ field: 'orgUnitId', message: USER_MESSAGES.risk.draftIncomplete.orgUnit });
  }
  if (!input.ownerUserId) {
    errors.push({ field: 'ownerUserId', message: USER_MESSAGES.risk.draftIncomplete.owner });
  }

  return errors;
}

export function assertCanLeaveDraft(input: DraftCompletenessInput): void {
  const errors = findDraftCompletenessGaps(input);

  if (errors.length > 0) {
    throw new ValidationDomainError(USER_MESSAGES.risk.draftIncomplete.title, errors);
  }
}
