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

    expect(cache.store.size).toBe(cacheSizeBeforeBump + 1);
    expect(await service.hasPermission('user-1', 'risk:view')).toBe(false);
  });
});
