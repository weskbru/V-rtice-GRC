import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

export function assertAssetOrgUnitProvided(orgUnitId: string | null | undefined): void {
  if (typeof orgUnitId !== 'string' || orgUnitId.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.assets.orgUnitRequired, [
      { field: 'orgUnitId', message: USER_MESSAGES.assets.orgUnitRequired },
    ]);
  }
}

export function assertAssetOrgUnitInScope(isOrgUnitUsable: boolean): void {
  if (!isOrgUnitUsable) {
    throw new ValidationDomainError(USER_MESSAGES.assets.orgUnitRequired, [
      { field: 'orgUnitId', message: USER_MESSAGES.assets.orgUnitRequired },
    ]);
  }
}

export const INVARIANT_A3_NOTE =
  'An asset’s name is never its identity — see this constant’s own doc comment.';

export function assertAssetNameProvided(name: string | null | undefined): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.assets.nameRequired, [
      { field: 'name', message: USER_MESSAGES.assets.nameRequired },
    ]);
  }
}

export const INVARIANT_A5_NOTE =
  'An inactive asset refuses a new link — enforced by the two linking use ' +
  'cases named in this constant’s own doc comment, not by this file.';

export const INVARIANT_A6_NOTE =
  'code is never client-supplied — enforced by the validation pipe, not by this file.';
