/**
 * T038 — materialized-path maintenance and cycle prevention (ADR-004,
 * data-model.md §4). Pure domain logic: no I/O, no Prisma, no framework
 * import — every function here is a plain, deterministic transformation of
 * plain data, so it is exhaustively unit-testable without a database
 * (see test/unit/scope-resolver.spec.ts).
 *
 * ## Path format
 *
 * data-model.md: `path` is materialized as `/{id}/{id}/...`. This module
 * fixes the exact shape: every path begins and ends with `/`, and each
 * segment between slashes is one unit id — a root unit's path is
 * `/{rootId}/`, and a child's path is its parent's path with the child's
 * own id appended and a trailing `/`. This both-ends-anchored form is what
 * makes `startsWith` a correct, false-positive-free prefix test: without
 * the trailing slash, unit `/abc/` would wrongly appear to be a "prefix
 * ancestor" of an unrelated unit `/abcdef/`.
 *
 * ## Cycle prevention
 *
 * A reparent is a cycle exactly when the proposed new parent is the unit
 * being moved, or is anywhere in that unit's own current subtree (moving a
 * node under its own descendant, or under itself). `canReparent` decides
 * this by a single prefix check against the CURRENT (pre-move) path of the
 * unit being moved — correct because a node's descendants are, by
 * definition, exactly the nodes whose current path is prefixed by the
 * node's own current path.
 */

export interface OrgUnitPathInfo {
  readonly id: string;
  readonly path: string;
  readonly depth: number;
}

/** A node carrying enough of its own identity to be repathed as part of a
 * subtree recomputation (`recomputeSubtreePaths`). */
export interface OrgUnitNode {
  readonly id: string;
  readonly path: string;
  readonly depth: number;
}

/** The materialized path of a root unit (no parent). */
export function computeRootPath(id: string): OrgUnitPathInfo {
  return { id, path: `/${id}/`, depth: 0 };
}

/** The materialized path a NEW child of `parent` would receive. Does not
 * check for cycles — a brand-new unit cannot already be an ancestor of
 * `parent`, so none is possible when creating (as opposed to reparenting)
 * a unit. */
export function computeChildPath(parent: OrgUnitPathInfo, childId: string): OrgUnitPathInfo {
  return { id: childId, path: `${parent.path}${childId}/`, depth: parent.depth + 1 };
}

/** True when `path` names the same unit as `ofPath`, or a unit anywhere in
 * its subtree (inclusive). The building block both `canReparent` and
 * `recomputeSubtreePaths` are expressed in terms of. */
export function isSelfOrDescendantPath(path: string, ofPath: string): boolean {
  return path === ofPath || path.startsWith(ofPath);
}

/** True when `path` names a unit strictly inside `ofPath`'s subtree
 * (excludes `ofPath` itself). */
export function isStrictDescendantPath(path: string, ofPath: string): boolean {
  return path !== ofPath && path.startsWith(ofPath);
}

/**
 * Whether moving `unit` to become a child of `newParent` is legal. Refuses
 * exactly the two ways a reparent creates a cycle: making a unit its own
 * parent, and making a unit a child of one of its own descendants (which
 * includes making it a child of itself, already covered by the id check,
 * kept separate for a clearer refusal reason if a caller wants one).
 *
 * `newParent` must be the unit's proposed parent's CURRENT path info — the
 * check is meaningless against a stale path.
 */
export function canReparent(unit: OrgUnitPathInfo, newParent: OrgUnitPathInfo): boolean {
  if (unit.id === newParent.id) {
    return false;
  }
  return !isSelfOrDescendantPath(newParent.path, unit.path);
}

export interface SubtreeRecomputation {
  readonly movedUnit: OrgUnitPathInfo;
  readonly updatedDescendants: readonly OrgUnitNode[];
}

/**
 * Recomputes `path`/`depth` for a unit being reparented and for every node
 * in its current subtree, given the new parent's CURRENT path info. Pure:
 * takes the full list of current descendants (by current path/depth) and
 * returns their new values; the caller (an application-layer use case, a
 * later task) is responsible for fetching that list and persisting the
 * result inside one transaction, per data-model.md §4 ("`path` is
 * maintained inside the same transaction as any insert or reparent, with
 * the subtree updated and the change audited").
 *
 * Throws if `canReparent` would refuse the move (call it first to produce
 * a domain-level refusal instead of this exception) or if a supplied
 * "descendant" is not actually one — both indicate a caller error, not a
 * data condition this function should silently paper over.
 */
export function recomputeSubtreePaths(
  unit: OrgUnitPathInfo,
  newParent: OrgUnitPathInfo,
  currentDescendants: readonly OrgUnitNode[],
): SubtreeRecomputation {
  if (!canReparent(unit, newParent)) {
    throw new Error(
      `Reparenting ${unit.id} under ${newParent.id} would create a cycle (${newParent.id} is ${unit.id} or one of its descendants).`,
    );
  }

  const oldPrefix = unit.path;
  const newPath = `${newParent.path}${unit.id}/`;
  const newDepth = newParent.depth + 1;
  const depthDelta = newDepth - unit.depth;

  const updatedDescendants = currentDescendants.map((descendant) => {
    if (!isStrictDescendantPath(descendant.path, oldPrefix)) {
      throw new Error(
        `${descendant.id} (path ${descendant.path}) is not a descendant of ${unit.id} (path ${oldPrefix}).`,
      );
    }

    return {
      id: descendant.id,
      path: newPath + descendant.path.slice(oldPrefix.length),
      depth: descendant.depth + depthDelta,
    };
  });

  return {
    movedUnit: { id: unit.id, path: newPath, depth: newDepth },
    updatedDescendants,
  };
}
