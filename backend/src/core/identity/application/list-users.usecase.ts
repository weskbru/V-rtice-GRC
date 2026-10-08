import { Injectable } from '@nestjs/common';

import {
  UserDirectoryPort,
  type AdminSortDirection,
  type AdminUserRecord,
  type AdminUserSortField,
} from '../domain/ports/user-directory.port';

import type { UserStatus } from '@prisma/client';

export interface ListUsersInput {
  readonly page: number;
  readonly pageSize: number;
  readonly q: string | undefined;
  readonly status: UserStatus | undefined;
  readonly orgUnitId: string | undefined;
  readonly roleId: string | undefined;
  readonly sortField: AdminUserSortField;
  readonly sortDirection: AdminSortDirection;
}

export interface ListUsersResult {
  readonly items: readonly AdminUserRecord[];
  readonly total: number;
}

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly userDirectory: UserDirectoryPort) {}

  async execute(input: ListUsersInput): Promise<ListUsersResult> {
    return this.userDirectory.listAdmin(input);
  }
}
