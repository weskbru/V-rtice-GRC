/**
 * The organizational "assignment line" of a unit — the authoritative answer
 * to *who may be assigned responsibility for a record that belongs to unit
 * U*, expressed purely over materialized paths (ADR-004). No I/O, no
 * Prisma, no framework import.
 *
 * ## Why this exists at all
 *
 * It exists because three places disagreed about that question and nobody
 * owned it:
 *
 * - `GET /users` filtered the directory by the CALLER's own scope
 *   (`primaryOrgUnitId IN scope.unitIds`), which is a *browsing* rule —
 *   "whom may this actor look up" — silently reused as an *assignment*
 *   rule.
 * - `RiskForm` fed its required "Gestor do risco" picker from that browse
 *   listing.
 * - `CreateRiskUseCase` enforced only `assertUserActive(ownerUserId)` — any
 *   active user in the whole installation.
 *
 * Because organizational scope expands to descendants and never to
 * ancestors (FR-025b), an analyst scoped to a leaf unit saw only users
 * whose PRIMARY unit was that same leaf or below. Measured on the
 * development database: zero. Their own manager, sitting one level up, was
 * invisible; so were the 25 active users carrying no primary unit at all,
 * since `primaryOrgUnitId IN (...)` never matches NULL. The picker rendered
 * empty, the field is `required` in the contract, and risk creation was
 * therefore impossible from the UI for exactly the narrowly-scoped analyst
 * the Risk Analyst role exists to serve — while the API would have accepted
 * the very assignment the UI refused to offer.
 *
 * (Recorded as F-34's true root cause. The finding originally attributed
 * the same symptom to directory SIZE — "must render the whole directory,
 * and it now times out" — and a teardown was built against that reading.
 * The directory the scoped caller saw was not large, it was empty.)
 *
 * ## The rule
 *
 * The assignment line of unit U is U itself, every ANCESTOR of U, and every
 * DESCENDANT of U. Siblings and unrelated branches are excluded: a risk
 * owned in `DIV-A-TEAM-1` may be assigned upward to a manager in `DIV-A` or
 * `ROOT`, or downward to a sub-team, but not sideways to `DIV-A-TEAM-2`.
 * That is the narrowest set that answers the real case ("analyst in a leaf
 * unit, owner in an ancestor unit") without widening the directory into a
 * general-purpose people search.
 *
 * Ancestors are derived from the unit's own materialized path rather than
 * queried: `/{rootId}/{childId}/{unitId}/` already names every ancestor in
 * order, so the whole upward chain costs zero additional round trips.
 * Descendants still need the path-prefix query the scope resolver already
 * uses.
 *
 * Users with NO primary organizational unit are handled by the CALLER, not
 * here — see `UserDirectoryPort.listDirectory`, which admits them
 * explicitly: a user who is not recorded against any unit is not confined
 * to one, so they are assignable anywhere. Encoding that here would be
 * wrong, because this module answers a question about UNITS and such a user
 * has none.
 */

/**
 * Every unit id on `path`, from the root down to (and including) the unit
 * the path belongs to.
 *
 * `path` is `/{id}/{id}/.../{id}/` (see `org-unit-path.ts`, which fixes
 * that both-ends-anchored shape). A malformed or empty path yields an empty
 * list rather than a fabricated id — a caller holding no ancestors is a
 * caller that must fall back to refusing, never one that silently widens.
 */
export function parseAncestorOrSelfIds(path: string): readonly string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

/**
 * The full assignment line: ancestors-or-self (from `path`) unioned with
 * the already-resolved descendant ids.
 *
 * `descendantIds` is expected to be the output of the same
 * materialized-path expansion organizational scope itself uses
 * (`OrgScopeRepositoryPort.expandToDescendants`), which is inclusive of the
 * unit — the union makes any overlap irrelevant either way.
 */
export function buildAssignmentLine(
  path: string,
  descendantIds: Iterable<string>,
): ReadonlySet<string> {
  const line = new Set<string>(parseAncestorOrSelfIds(path));
  for (const id of descendantIds) {
    line.add(id);
  }
  return line;
}
