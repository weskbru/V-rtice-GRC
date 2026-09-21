/**
 * T015/006-assets-processes — `Asset`'s domain invariants (data-model.md
 * §4, Invariantes A1-A6). Pure domain logic, in the format
 * `grc/finding/domain/finding.entity.ts` already establishes — see that
 * file's header for why throwing `shared/errors/domain-error.ts` types
 * directly from here is not a boundary violation, and for the "assert a
 * caller-computed fact" / "document an invariant enforced elsewhere, or by
 * omission" split this file follows identically.
 *
 * `Asset` has no lifecycle transition table (unlike `Finding`/`Control`):
 * data-model.md §3 fixes the situation to exactly two states (`isActive`
 * boolean, research.md D-3) with exactly two edges (deactivate/reactivate),
 * neither of which is conditional on the record's own prior state beyond
 * "not already there" — so there is no `LEGAL_TRANSITIONS` table to own
 * here, only the six invariants below.
 *
 * ## The six invariants, and where each is actually enforced
 *
 * - **A1 — organizational unit required on creation.** Asserted below
 *   (`assertAssetOrgUnitProvided`) as a belt-and-suspenders domain check
 *   behind `CreateAssetRequestDto`'s own `orgUnitId: string` (required,
 *   `@IsUUID`, Fase 3's own scope) — the same "re-checked in the domain"
 *   shape `finding.entity.ts#assertReopenReasonProvided` already
 *   establishes for its own DTO-level requirement.
 * - **A2 — the unit must exist and lie within the creator's scope.**
 *   Spans two facts a use case resolves via I/O (`AssetDirectoryPort`+
 *   `ScopeFilter`, both outside this file's own pure-function contract) —
 *   asserted below (`assertAssetOrgUnitInScope`) the same "caller queries,
 *   this file only applies the rule" split
 *   `finding.entity.ts#assertFindingHasSupportingEvidence` already
 *   establishes for its own caller-computed boolean.
 * - **A3 — name is never identity.** Documented by omission
 *   (`INVARIANT_A3_NOTE` below), the same convention
 *   `finding.entity.ts#INVARIANT_F3_NOTE` uses for its own "enforced by the
 *   absence of a code path" invariant: there is no uniqueness constraint on
 *   `name`, in this file or in the schema, and there must never be one.
 * - **A4 — name required, non-blank.** Asserted below
 *   (`assertAssetNameProvided`).
 * - **A5 — an inactive asset refuses a NEW link.** Already enforced, on
 *   BOTH sides, by two use cases this fase does not own or touch:
 *   `modules/risk/application/links/asset-link.usecase.ts:82` and
 *   `modules/controls/application/links/control-asset-link.usecase.ts:57`.
 *   Documented by reference (`INVARIANT_A5_NOTE` below) rather than
 *   reimplemented here — there is no assertion function in THIS file for
 *   it, because `Asset`'s own record never decides whether a link may be
 *   created; the LINKING use case does.
 * - **A6 — `code` is never client-supplied.** Enforced entirely at the DTO/
 *   validation-pipe layer (`additionalProperties: false`,
 *   `contracts/assets.openapi.yaml`'s `CreateAssetRequest`/
 *   `UpdateAssetRequest`) — Fase 3's own scope. There is no function here
 *   for it, the same "enforced by omission" shape as A3/A5: the domain
 *   layer never receives a client-supplied `code` value to reject, because
 *   the validation pipe strips an unknown property before any application
 *   code runs. Documented (`INVARIANT_A6_NOTE` below) so a future change
 *   that accepts `code` from a request body is a deliberate, reviewed
 *   decision, not an accidental regression.
 */
import { ValidationDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';

/**
 * **Invariant A1** (data-model.md §4): an asset created by this API always
 * has an organizational unit. `orgUnitId` is required (belt-and-suspenders
 * behind the DTO's own `@IsUUID`, not optional) — the column stays
 * anulável for pre-existing rows only (research.md D-2); nothing this
 * module creates may omit it.
 */
export function assertAssetOrgUnitProvided(orgUnitId: string | null | undefined): void {
  if (typeof orgUnitId !== 'string' || orgUnitId.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.assets.orgUnitRequired, [
      { field: 'orgUnitId', message: USER_MESSAGES.assets.orgUnitRequired },
    ]);
  }
}

/**
 * **Invariant A2** (data-model.md §4): the target organizational unit must
 * exist and lie within the acting user's resolved scope, on BOTH creation
 * and reassignment (`PATCH`). Whether it does is computed by the caller
 * (`AssetDirectoryPort`/`OrganizationalUnit` lookup plus `ScopeFilter`,
 * Fase 3's own use case) — this function only applies the rule, the same
 * "caller queries, this file only asserts" split Invariant F1 already
 * establishes in `finding.entity.ts`.
 *
 * Deliberately collapses "does not exist" and "outside scope" into the
 * SAME refusal (FR-010: a record outside scope answers exactly like a
 * nonexistent one) — `isOrgUnitUsable` names the single caller-computed
 * boolean for both causes, never two separate booleans a caller could
 * report inconsistently.
 */
export function assertAssetOrgUnitInScope(isOrgUnitUsable: boolean): void {
  if (!isOrgUnitUsable) {
    throw new ValidationDomainError(USER_MESSAGES.assets.orgUnitRequired, [
      { field: 'orgUnitId', message: USER_MESSAGES.assets.orgUnitRequired },
    ]);
  }
}

/**
 * **Invariant A3** (enforced by omission, data-model.md §4): `name` is
 * never the identity of an asset. Two assets — even within the same
 * organizational unit — may share a `name`; only `id` (internal) and `code`
 * (external, server-generated) identify a record. There is no function
 * here for this rule — the rule IS the absence of any uniqueness
 * constraint on `name`, in this file or in the schema. Documented here, the
 * same convention `finding.entity.ts#INVARIANT_F3_NOTE` uses, so a future
 * change that adds one is a deliberate, reviewed decision, not an
 * accidental regression.
 */
export const INVARIANT_A3_NOTE =
  'An asset’s name is never its identity — see this constant’s own doc comment.';

/**
 * **Invariant A4** (data-model.md §4): `name` is required and may not be
 * only whitespace.
 */
export function assertAssetNameProvided(name: string | null | undefined): void {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationDomainError(USER_MESSAGES.assets.nameRequired, [
      { field: 'name', message: USER_MESSAGES.assets.nameRequired },
    ]);
  }
}

/**
 * **Invariant A5** (already enforced elsewhere, unchanged by this fase):
 * an inactive asset refuses to become the target of a NEW
 * `RiskAssetLink`/`ControlAssetLink` — it stays fully readable and stays
 * visible in every link it already has (FR-006). Enforced today, on both
 * sides, by `modules/risk/application/links/asset-link.usecase.ts:82` and
 * `modules/controls/application/links/control-asset-link.usecase.ts:57` —
 * neither owned nor touched by this fase. There is no function here for
 * it: `Asset`'s own record never decides whether a link may be created,
 * the LINKING use case does.
 */
export const INVARIANT_A5_NOTE =
  'An inactive asset refuses a new link — enforced by the two linking use ' +
  'cases named in this constant’s own doc comment, not by this file.';

/**
 * **Invariant A6** (enforced by omission, at the DTO/validation-pipe
 * layer): `code` is always server-generated (`AST-` prefix,
 * `GrcCodeSequence`) and never accepted from a client. There is no function
 * here for it — the domain layer never receives a client-supplied `code`
 * to reject, because `contracts/assets.openapi.yaml`'s
 * `additionalProperties: false` plus the platform's global validation pipe
 * reject it as an unknown property before any application code runs
 * (Fase 3's own scope, `create-asset.usecase.ts`/
 * `update-asset.usecase.ts`).
 */
export const INVARIANT_A6_NOTE =
  'code is never client-supplied — enforced by the validation pipe, not by this file.';
