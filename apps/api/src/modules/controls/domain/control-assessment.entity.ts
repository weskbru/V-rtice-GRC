import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { ControlStatus } from '@prisma/client';

export function assertAssessedOnNotInFuture(assessedOn: Date, referenceDate: Date): void {
  if (assessedOn.getTime() > referenceDate.getTime()) {
    throw new ValidationDomainError(USER_MESSAGES.controls.assessment.assessedOnInFuture, [
      { field: 'assessedOn', message: USER_MESSAGES.controls.assessment.assessedOnInFuture },
    ]);
  }
}

export function assertControlAcceptsNewAssessment(status: ControlStatus): void {
  if (status !== 'ACTIVE') {
    throw new ValidationDomainError(USER_MESSAGES.controls.assessment.controlNotActive, [
      { field: 'controlId', message: USER_MESSAGES.controls.assessment.controlNotActive },
    ]);
  }
}
