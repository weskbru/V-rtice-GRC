/**
 * `ScopeFilter` (T040 / ADR-004 / FR-025).
 *
 * The organizational-scope predicate every scoped repository method must
 * apply. Lives in `shared/**` — not in `core/organizations`, where the
 * logic that PRODUCES values of this type lives — because `shared/**` may
 * not import from `core/**` (ADR-011), but `core/organizations` (and any
 * future module) may freely import `shared`. `ScopedRepository` (this
 * directory) can therefore depend on the type without depending on the
 * capability that computes it.
 *
 * ## Why this is a closed union with no "unrestricted-by-omission" case
 *
 * The classic catastrophic bug in a scope system is a missing/`undefined`
 * filter being silently treated as "no restriction" instead of "no
 * access". This type makes that reading structurally unavailable:
 *
 * - `{ kind: 'GLOBAL' }` is the ONLY representation of "unrestricted", and
 *   it is never the default — `ScopeResolverService` only ever produces it
 *   from an explicit, audited `OrgScopeGrant` row (FR-025a). There is no
 *   "no filter supplied" state that a caller could mistake for this one.
 * - `{ kind: 'UNIT', unitIds: ReadonlySet<string> }` covers every other
 *   case, INCLUDING a user with no grants at all — that user resolves to
 *   `unitIds` being the empty set, not to `undefined` and not to `GLOBAL`.
 *   `ScopedRepository.applyScope` (below) turns an empty set into a
 *   predicate that matches nothing (`{ in: [] }`), so "no grants" denies
 *   every row rather than silently applying no filter at all.
 *
 * Because `ScopeFilter` has no optional field and no third "unset" arm,
 * there is no way to construct a value of this type that means "I don't
 * know / skip the check" — every value is an explicit, total answer to
 * "which organizational units may this caller see".
 */

export type ScopeFilterKind = 'GLOBAL' | 'UNIT';

export interface GlobalScopeFilter {
  readonly kind: 'GLOBAL';
}

export interface UnitScopeFilter {
  readonly kind: 'UNIT';
  /** The concrete set of organizational unit ids the caller may access —
   * already expanded to include descendants (FR-025b). May be empty,
   * which is exactly the "no grants" case and must deny every row. */
  readonly unitIds: ReadonlySet<string>;
}

export type ScopeFilter = GlobalScopeFilter | UnitScopeFilter;

/** The empty, deny-everything scope — used by producers of `ScopeFilter`
 * (e.g. `ScopeResolverService`) for a caller with no `OrgScopeGrant` rows
 * at all, so that state is expressed once, by name, rather than by
 * constructing `{ kind: 'UNIT', unitIds: new Set() }` ad hoc at every call
 * site. */
export function emptyScope(): UnitScopeFilter {
  return { kind: 'UNIT', unitIds: new Set<string>() };
}

export function globalScope(): GlobalScopeFilter {
  return { kind: 'GLOBAL' };
}

export function unitScope(unitIds: ReadonlySet<string> | readonly string[]): UnitScopeFilter {
  return { kind: 'UNIT', unitIds: unitIds instanceof Set ? unitIds : new Set(unitIds) };
}

/**
 * The single predicate `ScopeFilter` compiles down to, factored out of
 * `ScopedRepository.applyScope` (T040) so a repository that cannot extend
 * that base class — because it already extends a different abstract
 * port class, e.g. `PrismaUserDirectoryRepository extends UserDirectoryPort`
 * (T095b, FR-025 applied to the `/users` directory lookup) — still applies
 * the IDENTICAL rule rather than a hand-rolled duplicate: `GLOBAL` means no
 * predicate at all, and `UNIT` (including the empty-set "no grants" case)
 * means `field IN (...)`, which is `IN ()` — matching nothing — when the set
 * is empty. `ScopedRepository.applyScope` below is now a thin wrapper over
 * this function; the two must never diverge.
 */
export function applyScopeToWhere<TWhere extends Record<string, unknown>>(
  scope: ScopeFilter,
  scopeField: keyof TWhere & string,
  where: TWhere,
): TWhere {
  if (scope.kind === 'GLOBAL') {
    return where;
  }

  return {
    ...where,
    [scopeField]: { in: Array.from(scope.unitIds) },
  };
}
