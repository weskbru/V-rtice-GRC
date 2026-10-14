import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

export function assertProcessOrgUnitProvided(orgUnitId: string | null | undefined): void {
  if (typeof orgUnitId !== 'string' || orgUnitId.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.processes.orgUnitRequired, [
      { field: 'orgUnitId', message: USER_MESSAGES.processes.orgUnitRequired },
    ]);
  }
}

export function assertProcessOrgUnitInScope(isOrgUnitUsable: boolean): void {
  if (!isOrgUnitUsable) {
    throw new ValidationDomainError(USER_MESSAGES.processes.orgUnitRequired, [
      { field: 'orgUnitId', message: USER_MESSAGES.processes.orgUnitRequired },
    ]);
  }
}

export const INVARIANT_A3_NOTE =
  'A process’s name is never its identity — see this constant’s own doc comment.';

export function assertProcessNameProvided(name: string | null | undefined): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.processes.nameRequired, [
      { field: 'name', message: USER_MESSAGES.processes.nameRequired },
    ]);
  }
}

export const INVARIANT_A5_NOTE =
  'An inactive process refuses a new link — enforced by the two linking use ' +
  'cases named in this file’s own header, not by this file.';

export const INVARIANT_A6_NOTE =
  'code is never client-supplied — enforced by the validation pipe, not by this file.';
