/**
 * T041 — unit tests for the organizational scope engine (ADR-004).
 * Pure unit tests, no I/O: `ScopeResolverService` is exercised against
 * fake, in-memory implementations of `OrgScopeRepositoryPort` and
 * `ScopeCachePort`; `org-unit-path.ts`'s pure functions are exercised
 * directly. No Prisma, no database, no network.
 *
 * Coverage required by T041:
 *   - descendant expansion via path prefix
 *   - GLOBAL grant behavior
 *   - empty-scope denies everything
 *   - cycle rejection on reparent
 *   - path/depth recomputation across a subtree move
 */
import { describe, expect, it } from 'vitest';

import { ScopeResolverService } from '../../src/core/organizations/application/scope-resolver.service';
import {
  canReparent,
  computeChildPath,
  computeRootPath,
  recomputeSubtreePaths,
  type OrgUnitNode,
  type OrgUnitPathInfo,
} from '../../src/core/organizations/domain/org-unit-path';
import {
  OrgScopeRepositoryPort,
  type OrgScopeGrantRecord,
} from '../../src/core/organizations/domain/ports/org-scope-repository.port';
import {
  ScopeCachePort,
  type CachedScopeFilter,
} from '../../src/core/organizations/domain/ports/scope-cache.port';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

/** A small fake org tree, built with the real path-computation functions so
 * "descendant expansion via path prefix" genuinely exercises prefix
 * matching rather than a hardcoded fixture:
 *
 *   root
 *   ├── unitA
 *   │   └── unitA1
 *   └── unitB
 */
function buildFakeTree(): readonly OrgUnitPathInfo[] {
  const root = computeRootPath('root');
  const unitA = computeChildPath(root, 'unitA');
  const unitA1 = computeChildPath(unitA, 'unitA1');
  const unitB = computeChildPath(root, 'unitB');
  return [root, unitA, unitA1, unitB];
}

class FakeOrgScopeRepository extends OrgScopeRepositoryPort {
  orgTreeVersion = 1;
  grantsVersion = 1;
  grantsByUser = new Map<string, readonly OrgScopeGrantRecord[]>();
  tree: readonly OrgUnitPathInfo[] = buildFakeTree();

  getUserGrants(userId: string): Promise<readonly OrgScopeGrantRecord[]> {
    return Promise.resolve(this.grantsByUser.get(userId) ?? []);
  }

  /** Real prefix-match logic against the fake tree — this is what makes
   * the "descendant expansion via path prefix" test meaningful. */
  expandToDescendants(orgUnitIds: readonly string[]): Promise<ReadonlySet<string>> {
    const grantedPaths = this.tree
      .filter((unit) => orgUnitIds.includes(unit.id))
      .map((unit) => unit.path);
    const matched = this.tree.filter((unit) =>
      grantedPaths.some((prefix) => unit.path.startsWith(prefix)),
    );
    return Promise.resolve(new Set(matched.map((unit) => unit.id)));
  }

  getOrgTreeVersion(): Promise<number> {
    return Promise.resolve(this.orgTreeVersion);
  }

  getGrantsVersion(): Promise<number> {
    return Promise.resolve(this.grantsVersion);
  }

  bumpOrgTreeVersion(): Promise<number> {
    this.orgTreeVersion += 1;
    return Promise.resolve(this.orgTreeVersion);
  }

  bumpGrantsVersion(): Promise<number> {
    this.grantsVersion += 1;
    return Promise.resolve(this.grantsVersion);
  }

  // T179 — not exercised by this suite (scope-grant administration is
  // covered by its own tests); stubbed only so this fake still satisfies
  // the port's full interface.
  userExists(): ReturnType<OrgScopeRepositoryPort['userExists']> {
    return Promise.resolve(true);
  }

  listDetailedGrants(): ReturnType<OrgScopeRepositoryPort['listDetailedGrants']> {
    return Promise.resolve([]);
  }

  findDuplicateGrant(): ReturnType<OrgScopeRepositoryPort['findDuplicateGrant']> {
    return Promise.resolve(undefined);
  }

  createGrant(): ReturnType<OrgScopeRepositoryPort['createGrant']> {
    return Promise.reject(new Error('FakeOrgScopeRepository.createGrant is not implemented'));
  }

  findGrantById(): ReturnType<OrgScopeRepositoryPort['findGrantById']> {
    return Promise.resolve(undefined);
  }

  deleteGrant(): ReturnType<OrgScopeRepositoryPort['deleteGrant']> {
    return Promise.resolve();
  }
}

class FakeScopeCache extends ScopeCachePort {
  store = new Map<string, CachedScopeFilter>();
  getCallCount = 0;

  get(key: string): Promise<CachedScopeFilter | undefined> {
    this.getCallCount += 1;
    return Promise.resolve(this.store.get(key));
  }

  set(key: string, scope: CachedScopeFilter): Promise<void> {
    this.store.set(key, scope);
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// ScopeResolverService
// ---------------------------------------------------------------------------

describe('ScopeResolverService', () => {
  it('expands a UNIT grant to include the granted unit and every descendant via path prefix', async () => {
    const repository = new FakeOrgScopeRepository();
    repository.grantsByUser.set('user-1', [{ scopeType: 'UNIT', orgUnitId: 'unitA' }]);
    const service = new ScopeResolverService(repository, new FakeScopeCache());

    const scope = await service.resolveScope('user-1');

    expect(scope.kind).toBe('UNIT');
    if (scope.kind !== 'UNIT') throw new Error('unreachable');
    // unitA and its descendant unitA1 are included; the sibling unitB and
    // the root are not — proving this is a genuine prefix match, not "all
    // units" or "just the granted id".
    expect(scope.unitIds).toEqual(new Set(['unitA', 'unitA1']));
  });

  it('treats an explicit GLOBAL grant as unrestricted access (FR-025a)', async () => {
    const repository = new FakeOrgScopeRepository();
    repository.grantsByUser.set('user-1', [{ scopeType: 'GLOBAL' }]);
    const service = new ScopeResolverService(repository, new FakeScopeCache());

    const scope = await service.resolveScope('user-1');

    expect(scope).toEqual({ kind: 'GLOBAL' });
  });

  it('a GLOBAL grant wins even when the user also holds UNIT grants', async () => {
    const repository = new FakeOrgScopeRepository();
    repository.grantsByUser.set('user-1', [
      { scopeType: 'UNIT', orgUnitId: 'unitA' },
      { scopeType: 'GLOBAL' },
    ]);
    const service = new ScopeResolverService(repository, new FakeScopeCache());

    const scope = await service.resolveScope('user-1');

    expect(scope).toEqual({ kind: 'GLOBAL' });
  });

  it('DENIES EVERYTHING for a user with no grants at all — never "no filter"', async () => {
    const repository = new FakeOrgScopeRepository();
    // Deliberately no entry in grantsByUser for this user: the exact "zero
    // OrgScopeGrant rows" case the task calls out as the classic
    // catastrophic scope-system bug.
    const service = new ScopeResolverService(repository, new FakeScopeCache());

    const scope = await service.resolveScope('user-with-no-grants');

    // The assertion that matters: this MUST be a UNIT scope with an empty
    // set, never `{ kind: 'GLOBAL' }` and never anything that
    // `ScopedRepository.applyScope` could read as "skip the filter".
    expect(scope).toEqual({ kind: 'UNIT', unitIds: new Set() });

    // Demonstrate the actual deny-everything behavior, not just the shape:
    // apply the same predicate `ScopedRepository` would, against a
    // representative row, and show it matches nothing.
    if (scope.kind !== 'UNIT') throw new Error('unreachable');
    const wouldMatchAnyRow = ['unitA', 'unitA1', 'unitB', 'root'].some((candidateOrgUnitId) =>
      scope.unitIds.has(candidateOrgUnitId),
    );
    expect(wouldMatchAnyRow).toBe(false);
  });

  it('caches the resolved scope and does not recompute on a repeated call with unchanged versions', async () => {
    const repository = new FakeOrgScopeRepository();
    repository.grantsByUser.set('user-1', [{ scopeType: 'UNIT', orgUnitId: 'unitB' }]);
    const cache = new FakeScopeCache();
    const service = new ScopeResolverService(repository, cache);

    const first = await service.resolveScope('user-1');
    // Mutate the fake repository's underlying grants after the first call —
    // if the second call recomputed instead of hitting the cache, it would
    // observe this change and the two results would differ.
    repository.grantsByUser.set('user-1', [{ scopeType: 'GLOBAL' }]);
    const second = await service.resolveScope('user-1');

    expect(second).toEqual(first);
  });

  it('invalidates the cached scope when grantsVersion changes, even with no direct cache deletion', async () => {
    const repository = new FakeOrgScopeRepository();
    repository.grantsByUser.set('user-1', [{ scopeType: 'UNIT', orgUnitId: 'unitB' }]);
    const cache = new FakeScopeCache();
    const service = new ScopeResolverService(repository, cache);

    const before = await service.resolveScope('user-1');
    await repository.bumpGrantsVersion();
    repository.grantsByUser.set('user-1', [{ scopeType: 'UNIT', orgUnitId: 'unitA' }]);
    const after = await service.resolveScope('user-1');

    expect(before).not.toEqual(after);
    if (after.kind !== 'UNIT') throw new Error('unreachable');
    expect(after.unitIds).toEqual(new Set(['unitA', 'unitA1']));
  });
});

// ---------------------------------------------------------------------------
// org-unit-path.ts — materialized path maintenance and cycle prevention
// ---------------------------------------------------------------------------

describe('org-unit-path', () => {
  it('computes a root path and depth', () => {
    expect(computeRootPath('root')).toEqual({ id: 'root', path: '/root/', depth: 0 });
  });

  it('computes a child path and depth relative to its parent', () => {
    const root = computeRootPath('root');
    const child = computeChildPath(root, 'child');
    expect(child).toEqual({ id: 'child', path: '/root/child/', depth: 1 });
  });

  describe('cycle rejection on reparent', () => {
    it('refuses making a unit its own parent', () => {
      const unit = computeRootPath('unit');
      expect(canReparent(unit, unit)).toBe(false);
    });

    it('refuses making a unit a child of its own descendant', () => {
      const root = computeRootPath('root');
      const child = computeChildPath(root, 'child');
      const grandchild = computeChildPath(child, 'grandchild');

      // Attempting to move `child` under its own descendant `grandchild`.
      expect(canReparent(child, grandchild)).toBe(false);
    });

    it('refuses making a unit a child of itself one level removed (self via a stale reference)', () => {
      const root = computeRootPath('root');
      const child = computeChildPath(root, 'child');
      expect(canReparent(child, child)).toBe(false);
    });

    it('allows reparenting to an unrelated unit (not itself, not a descendant)', () => {
      const root = computeRootPath('root');
      const child = computeChildPath(root, 'child');
      const unrelated = computeChildPath(root, 'unrelated');

      expect(canReparent(child, unrelated)).toBe(true);
    });

    it('allows reparenting to an ancestor further up the tree (moving up a level)', () => {
      const root = computeRootPath('root');
      const parent = computeChildPath(root, 'parent');
      const child = computeChildPath(parent, 'child');

      expect(canReparent(child, root)).toBe(true);
    });

    it('recomputeSubtreePaths throws rather than silently applying a cyclical move', () => {
      const root = computeRootPath('root');
      const child = computeChildPath(root, 'child');
      const grandchild = computeChildPath(child, 'grandchild');

      expect(() => recomputeSubtreePaths(child, grandchild, [grandchild])).toThrow(/cycle/i);
    });
  });

  describe('path/depth recomputation across a subtree move', () => {
    it('recomputes the moved unit and every descendant under a new parent', () => {
      // Before the move:
      //   root
      //   ├── branch
      //   │   └── moved
      //   │       ├── leafA
      //   │       └── leafB
      //   └── destination
      const root = computeRootPath('root');
      const branch = computeChildPath(root, 'branch');
      const moved = computeChildPath(branch, 'moved');
      const leafA = computeChildPath(moved, 'leafA');
      const leafB = computeChildPath(moved, 'leafB');
      const destination = computeChildPath(root, 'destination');

      const descendants: readonly OrgUnitNode[] = [leafA, leafB];

      const result = recomputeSubtreePaths(moved, destination, descendants);

      // `moved` now hangs off `destination`, one level deeper than before
      // (depth 2 under `branch` -> depth 2 under `destination`, since both
      // parents are at depth 1 — the delta is 0 here; assert the actual
      // new path/depth explicitly rather than relying on the delta).
      expect(result.movedUnit).toEqual({ id: 'moved', path: '/root/destination/moved/', depth: 2 });

      const leafAResult = result.updatedDescendants.find((node) => node.id === 'leafA');
      const leafBResult = result.updatedDescendants.find((node) => node.id === 'leafB');
      expect(leafAResult).toEqual({
        id: 'leafA',
        path: '/root/destination/moved/leafA/',
        depth: 3,
      });
      expect(leafBResult).toEqual({
        id: 'leafB',
        path: '/root/destination/moved/leafB/',
        depth: 3,
      });
    });

    it('adjusts descendant depth by the correct delta when the move changes tree depth', () => {
      // `moved` starts at depth 1 (directly under root) and is moved under
      // `deepDestination`, which is at depth 2 — every descendant must
      // shift by the same +2 depth delta as `moved` itself.
      const root = computeRootPath('root');
      const moved = computeChildPath(root, 'moved');
      const leaf = computeChildPath(moved, 'leaf');

      const intermediate = computeChildPath(root, 'intermediate');
      const deepDestination = computeChildPath(intermediate, 'deepDestination');

      const result = recomputeSubtreePaths(moved, deepDestination, [leaf]);

      expect(result.movedUnit.depth).toBe(3); // was 1, deepDestination.depth (2) + 1
      expect(result.updatedDescendants[0]).toEqual({
        id: 'leaf',
        path: '/root/intermediate/deepDestination/moved/leaf/',
        depth: 4, // was 2, shifted by the same +2 delta as `moved`
      });
    });

    it('refuses to recompute when a supplied node is not actually a descendant', () => {
      const root = computeRootPath('root');
      const moved = computeChildPath(root, 'moved');
      const destination = computeChildPath(root, 'destination');
      const notADescendant: OrgUnitNode = { id: 'stranger', path: '/root/stranger/', depth: 1 };

      expect(() => recomputeSubtreePaths(moved, destination, [notADescendant])).toThrow(
        /not a descendant/,
      );
    });
  });
});
