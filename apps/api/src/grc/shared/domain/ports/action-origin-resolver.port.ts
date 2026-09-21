/**
 * T048/002-shared-grc-foundation, US2 — the registry that lets
 * `grc/action` resolve an `Action`'s origin (existence, organizational
 * scope, EDIT permission, display label) BY `ActionOriginType`, without
 * `grc/**` ever importing `modules/**` (ADR-016 forbids it). This is
 * R-001's closed-type-registration mechanism applied to `Action.originId`
 * — the WRITE-side counterpart of
 * `evidence-subject-resolver.port.ts`'s READ-side registry; see that
 * file's header for the full worked example this one does not repeat.
 *
 * ## `resolveEditableOrigin`, not `resolveViewableOrigin`
 *
 * `createAction`'s own contract description: "Requires `action:create`,
 * plus EDIT permission and scope on the origin record — work is created by
 * whoever may act on the thing it arises from" (FR-031). This is
 * deliberately a STRICTER check than `EvidenceSubjectAccessor
 * .resolveViewableSubject` (view permission) — linking evidence to a
 * subject only requires seeing it, but creating work FROM a subject
 * requires being allowed to act on it. A future origin type's accessor
 * (`FINDING`, a later agent's scope) implements this against its own
 * `finding:edit`-equivalent permission.
 *
 * ## Who registers what
 *
 * - `modules/risk` registers `RISK_TREATMENT` from its own composition
 *   root (`RiskModule`'s constructor, T049/US2), checking `risk:treat` —
 *   the SAME permission `POST /risks/{riskId}/treatment-actions` itself
 *   requires (`treatment.controller.ts`). `grc/**` never imports
 *   `modules/risk` to make this work; the dependency points the other way.
 * - `FINDING` is registered from `grc/finding`'s own composition root (a
 *   later agent's scope, US3) — `grc/action` never edits this file to add
 *   it.
 */
import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ActionOriginType } from '@prisma/client';

/** Returned by a successful `resolveEditableOrigin` call. */
export interface ActionOriginAccess {
  /** The origin's own organizational unit — becomes the new `Action`'s
   * `orgUnitId` (data-model.md §4: `Action` has no caller-supplied org unit
   * of its own) and the resulting audit entry's `organizationalUnitId`. */
  readonly organizationalUnitId: string;
  /** Human-readable label for display (`Action.originLabel`,
   * contracts/grc-foundation.openapi.yaml) — resolved here, not
   * reconstructed by the presentation layer, because only the owning
   * module knows how to label its own record. */
  readonly label: string;
}

/** The contract each origin type's owning module implements once
 * (`RiskActionOriginAccessor`, T049, is `RISK_TREATMENT`'s). */
export interface ActionOriginAccessor {
  /**
   * Resolves whether `actorUserId` currently holds EDIT authority over the
   * origin record `originId`. MUST throw {@link NotFoundDomainError} —
   * never `ForbiddenDomainError` — for every reason the actor may not
   * proceed: missing edit permission on the origin's own type, out of the
   * actor's organizational scope, or the record genuinely does not exist.
   * All three must be indistinguishable to the caller (FR-030, FR-032,
   * SC-005) — the identical contract
   * `EvidenceSubjectAccessor.resolveViewableSubject` already establishes.
   * Used ONLY at `createAction` time (FR-031).
   */
  resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess>;

  /**
   * The read-side counterpart, used ONLY to populate `Action.originLabel`
   * on `getAction`/`listActions` (an OPTIONAL display field,
   * contracts/grc-foundation.openapi.yaml — its own schema does not list it
   * as required). Checked against the origin's own VIEW permission
   * (weaker than `resolveEditableOrigin`'s edit gate) — an actor who may
   * see an `Action` but not its `RISK_TREATMENT` origin must still see the
   * action itself; `GetActionUseCase`/`ListActionUseCase` catch
   * `NotFoundDomainError` from this method and simply omit the label
   * (R-010's own "omit what the reader may not see, do not fail the whole
   * read" precedent), rather than let a stricter origin-visibility rule
   * block the read of the action.
   */
  resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess>;

  /**
   * SCOPE-ONLY re-check of the origin's CURRENT organizational unit — no
   * permission check on the origin's own type at all (assurance fix,
   * confirmed breach: `Action.orgUnitId` is stamped once at creation from
   * `resolveEditableOrigin`'s result and never revisited, so it goes stale
   * the moment the origin — e.g. a `Risk` — is later reassigned to a
   * different unit via its own `PATCH`; `Action`'s directly-addressable
   * `GET`/`PATCH`/`POST .../transitions` routes were still trusting that
   * stale snapshot). `GetActionUseCase`/`UpdateActionUseCase`/
   * `TransitionActionUseCase` call this on every request instead, so
   * access tracks the origin's LIVE unit rather than a creation-time copy
   * — the same "never persisted, always re-resolved" answer
   * `EvidenceLinkVisibilityService` already gives for a link's subject.
   *
   * Deliberately NOT `resolveViewableOrigin`/`resolveEditableOrigin`
   * reused as-is: both ALSO gate on the origin's own view/edit permission
   * (`risk:view`/`risk:treat` for `RISK_TREATMENT`), which is a different
   * and stricter question than "which unit does this record currently
   * belong to". `Action` carries its own, independent `action:view`/
   * `action:edit` permission model — an actor may hold `action:edit` over
   * a `RISK_TREATMENT`-origin action without holding `risk:treat` at all
   * (`platform.seed.ts`'s Risk Analyst role is exactly this: it may work
   * an action assigned to it end-to-end without ever holding `risk:treat`
   * on the risk that spawned it), and an actor may see an `Action` whose
   * origin they cannot see at all (the existing `originLabel`-omission
   * contract). Requiring origin permission here would silently revoke
   * both of those already-relied-upon behaviors — a second regression
   * riding along with the scope fix, not the fix itself.
   *
   * MUST throw {@link NotFoundDomainError} when the origin no longer
   * exists or `actorUserId`'s organizational scope no longer covers its
   * current unit — never return a sentinel "no access" value — so a
   * caller that forgets to handle it fails loudly. Callers MUST re-key
   * that error to their OWN resource's id before letting it reach an HTTP
   * response (mirrors `core/files/application/attachment-access.ts`'s
   * documented reasoning): this method's error is keyed by the ORIGIN's
   * id (e.g. the `Risk`'s), which the caller of an `Action`-by-id route
   * never supplied, so leaving it unconverted would both disclose a UUID
   * the caller never supplied and make "action does not exist"
   * distinguishable from "action exists but its origin fell out of
   * scope" (FR-030).
   */
  resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess>;

  /**
   * Bulk, SCOPE-ONLY counterpart to `resolveOriginScope` above — assurance
   * fix (Fix 1, confirmed breach): `ListActionUseCase` used to filter on
   * `Action.orgUnitId`'s stale creation-time snapshot, so a custodian who
   * lost scope over the origin (the exact scenario `resolveOriginScope`
   * closed for the single-row routes) could still SEE the action — its
   * code and title — in a list, even though `GET`/`PATCH`/transition on it
   * correctly 404'd.
   *
   * Returns every origin id of THIS type whose CURRENT organizational unit
   * is included in `scope.unitIds` — a single query against the origin's
   * own table, in the SAME shape `ScopedRepository`-based repositories
   * already use for `orgUnitId IN (...)` — never one call per candidate
   * origin id (that would turn one list query into N+1, exactly what this
   * method exists to avoid). `ListActionUseCase` calls this AT MOST once
   * per registered origin type per list request (a small, fixed number,
   * never proportional to the number of `Action` rows), then folds the
   * results into a single `originId IN (...)` predicate per type on the
   * `Action` query itself — so pagination and `total` stay correct without
   * any per-row scope re-check.
   *
   * Takes an already-resolved `UnitScopeFilter`, not `actorUserId` — the
   * caller has already resolved the actor's scope once for the whole page,
   * and a `{ kind: 'GLOBAL' }` scope needs no restriction at all (every
   * origin id is trivially in scope), so `ListActionUseCase` never calls
   * this method in that case. No permission check, exactly like
   * `resolveOriginScope` (see that method's own doc comment for why).
   */
  listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]>;
}

export class ActionOriginTypeNotRegisteredError extends Error {
  constructor(originType: string) {
    super(
      `No action-origin accessor is registered for "${originType}". Register one with ` +
        "registerActionOriginResolver(...) from the owning module's own composition root " +
        '(see grc/shared/domain/ports/action-origin-resolver.port.ts).',
    );
    this.name = 'ActionOriginTypeNotRegisteredError';
  }
}

const registry = new Map<ActionOriginType, ActionOriginAccessor>();

/** Registers `accessor` for `originType`. Throws if `originType` is already
 * registered — two modules disagreeing about one origin type's accessor is
 * a configuration bug, never resolved by "last write wins" (same
 * discipline as `registerEvidenceSubjectResolver`). */
export function registerActionOriginResolver(
  originType: ActionOriginType,
  accessor: ActionOriginAccessor,
): void {
  if (registry.has(originType)) {
    throw new Error(
      `Action origin type "${originType}" is already registered. Each origin type may be ` +
        'registered exactly once.',
    );
  }
  registry.set(originType, accessor);
}

/** Looks up the registered accessor for `originType`. Throws
 * {@link ActionOriginTypeNotRegisteredError} rather than returning
 * `undefined` — a valid enum member with no registered accessor is a
 * missing bootstrap registration (e.g. `FINDING` before its owning module
 * exists), not a case to be silently treated as "always allowed" or
 * "never allowed". */
export function getActionOriginAccessor(originType: ActionOriginType): ActionOriginAccessor {
  const accessor = registry.get(originType);
  if (!accessor) {
    throw new ActionOriginTypeNotRegisteredError(originType);
  }
  return accessor;
}

/** Every currently-registered `ActionOriginType` — used by
 * `ListActionUseCase` (Fix 1) to enumerate which types need a
 * `listOriginIdsInScope` call when the caller did not narrow the listing to
 * one specific `originType` itself. Order is insertion order (registration
 * order at bootstrap); callers must not depend on it. */
export function listRegisteredActionOriginTypes(): readonly ActionOriginType[] {
  return Array.from(registry.keys());
}

/** Test-only escape hatch, exactly like
 * `__resetEvidenceSubjectRegistryForTests` — clears the registry so a unit
 * test can exercise registration from a known-empty state. Never called by
 * application code. */
export function __resetActionOriginRegistryForTests(): void {
  registry.clear();
}
