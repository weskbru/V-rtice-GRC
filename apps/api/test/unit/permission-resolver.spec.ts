/**
 * Unit tests for `PermissionResolverService` (T036, ADR-003). Pure unit
 * tests, no I/O: fake in-memory implementations of `PermissionRepositoryPort`
 * and `PermissionCachePort` stand in for PostgreSQL and `CacheProvider`.
 */
import { describe, expect, it } from 'vitest';

import { PermissionResolverService } from '../../src/core/authorization/application/permission-resolver.service';
import { PermissionCachePort } from '../../src/core/authorization/domain/ports/permission-cache.port';
import { PermissionRepositoryPort } from '../../src/core/authorization/domain/ports/permission-repository.port';

class FakePermissionRepository extends PermissionRepositoryPort {
  version = 1;
  permissionsByUser = new Map<string, readonly string[]>();
  databaseReadCount = 0;

  getEffectivePermissionIdentifiers(userId: string): Promise<readonly string[]> {
    this.databaseReadCount += 1;
    return Promise.resolve(this.permissionsByUser.get(userId) ?? []);
  }

  getPermissionsVersion(): Promise<number> {
    return Promise.resolve(this.version);
  }

  bumpPermissionsVersion(): Promise<number> {
    this.version += 1;
    return Promise.resolve(this.version);
  }

  // T177 — not exercised by this suite (role/permission administration is
  // covered by its own tests); stubbed only so this fake still satisfies
  // the port's full interface.
  listAll(): ReturnType<PermissionRepositoryPort['listAll']> {
    return Promise.resolve([]);
  }

  findByIdentifiers(): ReturnType<PermissionRepositoryPort['findByIdentifiers']> {
    return Promise.resolve([]);
  }
}

class FakePermissionCache extends PermissionCachePort {
  store = new Map<string, readonly string[]>();

  get(key: string): Promise<readonly string[] | undefined> {
    return Promise.resolve(this.store.get(key));
  }

  set(key: string, permissionIdentifiers: readonly string[]): Promise<void> {
    this.store.set(key, permissionIdentifiers);
    return Promise.resolve();
  }
}

describe('PermissionResolverService', () => {
  it('resolves a user with no roles to an empty permission set (fails closed, not an error)', async () => {
    const service = new PermissionResolverService(
      new FakePermissionRepository(),
      new FakePermissionCache(),
    );

    const permissions = await service.getEffectivePermissions('user-1');

    expect(permissions.size).toBe(0);
    expect(await service.hasPermission('user-1', 'risk:view')).toBe(false);
  });

  it('falls back to the repository (PostgreSQL) on a cache miss and returns the identical answer', async () => {
    const repository = new FakePermissionRepository();
    repository.permissionsByUser.set('user-1', ['risk:view', 'risk:edit']);
    const service = new PermissionResolverService(repository, new FakePermissionCache());

    expect(await service.hasPermission('user-1', 'risk:view')).toBe(true);
    expect(await service.hasPermission('user-1', 'risk:administer')).toBe(false);
    expect(repository.databaseReadCount).toBeGreaterThan(0);
  });

  it('serves a cache hit without a second repository read', async () => {
    const repository = new FakePermissionRepository();
    repository.permissionsByUser.set('user-1', ['risk:view']);
    const service = new PermissionResolverService(repository, new FakePermissionCache());

    await service.getEffectivePermissions('user-1');
    const readsAfterFirstCall = repository.databaseReadCount;
    await service.getEffectivePermissions('user-1');

    expect(repository.databaseReadCount).toBe(readsAfterFirstCall);
  });

  it('invalidates the cache the moment permissionsVersion is bumped, applying on the next call (FR-028)', async () => {
    const repository = new FakePermissionRepository();
    repository.permissionsByUser.set('user-1', ['risk:view']);
    const service = new PermissionResolverService(repository, new FakePermissionCache());

    expect(await service.hasPermission('user-1', 'risk:administer')).toBe(false);

    // A role/permission change happens (would be done by the T177
    // administration use case) — simulated here by mutating the
    // repository's data and bumping the durable version counter.
    repository.permissionsByUser.set('user-1', ['risk:view', 'risk:administer']);
    await repository.bumpPermissionsVersion();

    expect(await service.hasPermission('user-1', 'risk:administer')).toBe(true);
  });

  it('does not let a stale cached value survive a version bump even though the old cache entry is never deleted', async () => {
    const repository = new FakePermissionRepository();
    repository.permissionsByUser.set('user-1', ['risk:view']);
    const cache = new FakePermissionCache();
    const service = new PermissionResolverService(repository, cache);

    await service.getEffectivePermissions('user-1');
    const cacheSizeBeforeBump = cache.store.size;

    repository.permissionsByUser.set('user-1', []);
    await repository.bumpPermissionsVersion();
    await service.getEffectivePermissions('user-1');

    // The old (version 1) entry is still sitting in the cache, unevicted —
    // and that is fine, because the new lookup key embeds version 2 and
    // never reads it.
    expect(cache.store.size).toBe(cacheSizeBeforeBump + 1);
    expect(await service.hasPermission('user-1', 'risk:view')).toBe(false);
  });
});
