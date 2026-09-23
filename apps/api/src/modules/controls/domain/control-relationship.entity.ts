import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { ControlStatus } from '@prisma/client';

const NON_LINKABLE_STATUSES: ReadonlySet<ControlStatus> = new Set(['RETIRED']);

export function assertControlAcceptsNewLink(status: ControlStatus): void {
  if (NON_LINKABLE_STATUSES.has(status)) {
    throw new ValidationDomainError(USER_MESSAGES.controls.relationships.controlRetired, [
      { field: 'id', message: USER_MESSAGES.controls.relationships.controlRetired },
    ]);
  }
}
