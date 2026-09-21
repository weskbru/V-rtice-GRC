/**
 * `ScopedRepository` (T040 / ADR-004 / FR-025).
 *
 * The base every repository that reads or writes an organizationally-scoped
 * entity (a `Risk`, eventually a `Problem`, an `Incident`, ...) must extend.
 * ADR-004 places scope enforcement in the repository layer rather than in
 * controllers specifically so a future module inherits it "by using the
 * same base repository" — this class, and nothing else, is that mechanism.
 *
 * ## The compile-time guarantee, precisely stated
 *
 * `applyScope` and `withScope` both take `scope: ScopeFilter` as a
 * required, non-optional, un-defaulted parameter. Any call site that omits
 * it fails `tsc` with "Expected N arguments, but got N-1" — this is a
 * genuine compile error, not a lint warning or a runtime check, and it is
 * demonstrated (then removed) in the implementation report's verification
 * transcript. A subclass method that threads its `where` input through
 * `withScope` therefore cannot forget the scope predicate: there is no
 * overload, no default value, and no way to widen `scope` to `undefined`
 * without changing this file.
 *
 * What this does NOT and cannot guarantee: nothing stops a subclass from
 * adding an entirely separate method that calls `this.prisma.client.risk
 * .findMany(...)` directly, bypassing this base altogether. That failure
 * mode is a code-review discipline, not a type-system one — no base class
 * in a language without an effect system can prevent a subclass from
 * simply not calling it. The concrete guarantee this class provides is
 * narrower and real: *if* a query is built through `applyScope`/
 * `withScope`, the scope argument cannot be forgotten.
 *
 * ## Why `shared/**` and not `core/organizations`
 *
 * `shared/**` may not import from `core/**` or `modules/**` (ADR-011), but
 * every layer of every capability and module may import `shared`. Placing
 * the base here — rather than in `core/organizations`, which is where the
 * logic that PRODUCES a `ScopeFilter` lives — means a business module's
 * repository (`modules/risk/infrastructure/risk.repository.ts`, a later
 * task) can extend `ScopedRepository` without taking a dependency on the
 * Organizations capability at all; it only needs a `ScopeFilter` value,
 * which is handed to it by whatever composed the use case.
 *
 * ## Empty scope, not "no filter"
 *
 * `ScopeFilter`'s `UNIT` arm carries a `ReadonlySet<string>` that may be
 * empty (see scope-filter.ts) — a user with zero `OrgScopeGrant` rows. This
 * class turns that into a Prisma `{ in: [] }` predicate, which matches no
 * row. It never special-cases an empty set into "skip the filter"; doing so
 * would be exactly the catastrophic inversion this module exists to
 * prevent.
 *
 * ## `resolveOrganizationalUnitIgnoringScope` — the refusal-path-only escape
 * hatch (F-38)
 *
 * `withScope`/`applyScope` collapse two different facts into the same
 * `null`/`undefined` result by construction: "this row does not exist" and
 * "this row exists, outside `scope`". That collapse is exactly FR-030's
 * non-disclosure guarantee for the HTTP response — but it also means a
 * scoped repository, on its own, cannot tell a use case which of the two
 * happened, and `core/organizations`'s `OrgScopeEnforcerService` (the
 * component that records a `DENIED` audit row for the second case, never
 * the first) needs exactly that distinction. `resolveOrganizationalUnitIgnoringScope`
 * below is the one place this base class provides an UNSCOPED lookup —
 * deliberately, and only for a caller that has already tried the scoped
 * query and gotten nothing back. See its own doc comment for the query-cost
 * reasoning and the non-disclosure guardrail.
 */
import { applyScopeToWhere } from './scope-filter';

import type { ScopeFilter } from './scope-filter';

export abstract class ScopedRepository<TWhereInput extends Record<string, unknown>> {
  /**
   * @param scopeField The property name on `TWhereInput` that identifies
   *   the entity's organizational unit (e.g. `'orgUnitId'` for `Risk`).
   *   Fixed per repository instance so every call site applies the
   *   predicate to the same column.
   */
  protected constructor(private readonly scopeField: keyof TWhereInput & string) {}

  /**
   * Merges the scope predicate into `where`. `scope` has no default and no
   * optional modifier — see the class-level doc comment for what that
   * guarantees and what it does not.
   */
  protected applyScope(scope: ScopeFilter, where: TWhereInput): TWhereInput {
    return applyScopeToWhere(scope, this.scopeField, where);
  }

  /**
   * Applies `applyScope` and immediately hands the result to `query` — the
   * recommended shape for a subclass method, e.g.:
   *
   * ```ts
   * async findById(scope: ScopeFilter, id: string): Promise<Risk | null> {
   *   return this.withScope(scope, { id }, (where) =>
   *     this.prisma.client.risk.findFirst({ where }),
   *   );
   * }
   * ```
   *
   * Requiring `scope` as `withScope`'s first argument (rather than letting
   * a subclass call `applyScope` and the Prisma delegate separately, in
   * either order, or not at all) keeps the two operations — building the
   * scoped `where` and executing the query against it — inseparable at the
   * one call site that matters.
   */
  protected withScope<TResult>(
    scope: ScopeFilter,
    where: TWhereInput,
    query: (scopedWhere: TWhereInput) => Promise<TResult>,
  ): Promise<TResult> {
    return query(this.applyScope(scope, where));
  }

  /**
   * Resolves a candidate record's ACTUAL organizational unit, ignoring
   * `scope` entirely (F-38, FR-030/FR-037). Exists for exactly one caller
   * shape: a scoped lookup (`withScope`/`applyScope`) has already returned
   * nothing, and the use case needs to know whether that is because the
   * record does not exist at all (no audit — recording a `DENIED` row for a
   * genuinely missing id would make the audit trail itself the oracle that
   * tells the two cases apart, worse than not recording scope denials at
   * all) or because it exists outside the caller's scope (audited via
   * `OrgScopeEnforcerService.assertExistingRecordAccessible`, then refused
   * identically).
   *
   * ## Cost — paid ONLY on this already-exceptional path
   *
   * `probe` is expected to run a SECOND, unscoped, `select`-only Prisma
   * lookup by primary key — one extra indexed round trip. It is never
   * called from `findById`/`update`/any method a successful request takes;
   * every call site in this codebase invokes it only after its own scoped
   * query already came back empty, i.e. only on the request that is about
   * to be refused. A confirmed-missing/out-of-scope access is already the
   * rare, non-hot-path branch (a 404, not a 200), so one extra
   * indexed-by-id `SELECT` there is the accepted cost of the alternative —
   * silently continuing to under-audit scope denials, F-38's own finding.
   *
   * ## Non-disclosure guardrail
   *
   * The returned org-unit id is for SERVER-SIDE audit content ONLY — it
   * must never reach an HTTP response body or message. `probe` must select
   * NOTHING beyond the scope column (and whatever the caller's own type
   * constrains `TRow` to); it must not `include`/`select` the record's
   * business content.
   */
  protected async resolveOrganizationalUnitIgnoringScope<
    TRow extends Partial<Record<string, unknown>> | null,
  >(probe: () => Promise<TRow>): Promise<string | undefined> {
    const row = await probe();
    if (row === null || row === undefined) {
      return undefined;
    }
    const value = row[this.scopeField];
    return typeof value === 'string' ? value : undefined;
  }
}
