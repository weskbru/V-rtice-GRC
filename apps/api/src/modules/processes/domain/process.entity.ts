/**
 * T015/006-assets-processes — `Process`'s domain invariants. Identical in
 * shape and reasoning to `modules/assets/domain/asset.entity.ts` (FR-020:
 * Asset and Process are promoted symmetrically, deliberately) — see that
 * file's header for the full account this one does not repeat, including
 * where each of Invariants A1-A6 is actually enforced.
 *
 * A5's two enforcing use cases, on this side: `modules/risk/application/
 * links/process-link.usecase.ts` and `modules/controls/application/links/
 * control-process-link.usecase.ts` — neither owned nor touched by this
 * fase.
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

/** **Invariant A1** — see `asset.entity.ts#assertAssetOrgUnitProvided`'s own
 * doc comment; identical contract, applied to `Process`. */
export function assertProcessOrgUnitProvided(orgUnitId: string | null | undefined): void {
  if (typeof orgUnitId !== 'string' || orgUnitId.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.processes.orgUnitRequired, [
      { field: 'orgUnitId', message: USER_MESSAGES.processes.orgUnitRequired },
    ]);
  }
}

/** **Invariant A2** — see `asset.entity.ts#assertAssetOrgUnitInScope`'s own
 * doc comment; identical contract, applied to `Process`. */
export function assertProcessOrgUnitInScope(isOrgUnitUsable: boolean): void {
  if (!isOrgUnitUsable) {
    throw new ValidationDomainError(USER_MESSAGES.processes.orgUnitRequired, [
      { field: 'orgUnitId', message: USER_MESSAGES.processes.orgUnitRequired },
    ]);
  }
}

/** **Invariant A3** (enforced by omission) — see
 * `asset.entity.ts#INVARIANT_A3_NOTE`'s own doc comment; identical
 * reasoning, applied to `Process`. */
export const INVARIANT_A3_NOTE =
  'A process’s name is never its identity — see this constant’s own doc comment.';

/** **Invariant A4** — see `asset.entity.ts#assertAssetNameProvided`'s own
 * doc comment; identical contract, applied to `Process`. */
export function assertProcessNameProvided(name: string | null | undefined): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.processes.nameRequired, [
      { field: 'name', message: USER_MESSAGES.processes.nameRequired },
    ]);
  }
}

/** **Invariant A5** (already enforced elsewhere, unchanged by this fase) —
 * see `asset.entity.ts#INVARIANT_A5_NOTE`'s own doc comment; the two
 * enforcing use cases on this side are named in this file's own header. */
export const INVARIANT_A5_NOTE =
  'An inactive process refuses a new link — enforced by the two linking use ' +
  'cases named in this file’s own header, not by this file.';

/** **Invariant A6** (enforced by omission, at the DTO/validation-pipe
 * layer) — see `asset.entity.ts#INVARIANT_A6_NOTE`'s own doc comment;
 * identical reasoning, applied to `Process` (`PRC-` prefix). */
export const INVARIANT_A6_NOTE =
  'code is never client-supplied — enforced by the validation pipe, not by this file.';
