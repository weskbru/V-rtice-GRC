import type { PermissionAction } from '@prisma/client';

export interface PermissionRecord {
  readonly id: string;
  readonly identifier: string;
  readonly resource: string;
  readonly action: PermissionAction;
  readonly description: string;
}

export abstract class PermissionRepositoryPort {
  abstract getEffectivePermissionIdentifiers(userId: string): Promise<readonly string[]>;

  abstract getPermissionsVersion(): Promise<number>;

  abstract bumpPermissionsVersion(): Promise<number>;

  abstract listAll(resource: string | undefined): Promise<readonly PermissionRecord[]>;

  abstract findByIdentifiers(identifiers: readonly string[]): Promise<readonly PermissionRecord[]>;
}
