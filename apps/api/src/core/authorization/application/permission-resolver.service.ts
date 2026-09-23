import { Injectable } from '@nestjs/common';

import { PermissionCachePort } from '../domain/ports/permission-cache.port';
import { PermissionRepositoryPort } from '../domain/ports/permission-repository.port';

import type { PermissionIdentifier } from '../domain/permissions';

const CACHE_KEY_PREFIX = 'authz:permissions';
const CACHE_TTL_SECONDS = 300;

@Injectable()
export class PermissionResolverService {
  constructor(
    private readonly repository: PermissionRepositoryPort,
    private readonly cache: PermissionCachePort,
  ) {}

  async getEffectivePermissions(userId: string): Promise<ReadonlySet<PermissionIdentifier>> {
    const version = await this.repository.getPermissionsVersion();
    const cacheKey = this.buildCacheKey(userId, version);

    const cached = await this.cache.get(cacheKey);
    if (cached !== undefined) {
      return new Set(cached) as ReadonlySet<PermissionIdentifier>;
    }

    const fresh = await this.repository.getEffectivePermissionIdentifiers(userId);
    await this.cache.set(cacheKey, fresh, CACHE_TTL_SECONDS);

    return new Set(fresh) as ReadonlySet<PermissionIdentifier>;
  }

  async hasPermission(userId: string, permission: PermissionIdentifier): Promise<boolean> {
    const permissions = await this.getEffectivePermissions(userId);
    return permissions.has(permission);
  }

  private buildCacheKey(userId: string, permissionsVersion: number): string {
    return `${CACHE_KEY_PREFIX}:${userId}:${String(permissionsVersion)}`;
  }
}
