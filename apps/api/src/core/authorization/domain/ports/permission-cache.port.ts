export abstract class PermissionCachePort {
  abstract get(key: string): Promise<readonly string[] | undefined>;
  abstract set(
    key: string,
    permissionIdentifiers: readonly string[],
    ttlSeconds: number,
  ): Promise<void>;
}
