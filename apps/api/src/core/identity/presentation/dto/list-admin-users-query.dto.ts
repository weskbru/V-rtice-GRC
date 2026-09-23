import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type {
  AdminSortDirection,
  AdminUserSortField,
} from '../../domain/ports/user-directory.port';
import type { UserStatus } from '@prisma/client';

const STATUS_VALUES: readonly UserStatus[] = ['ACTIVE', 'INACTIVE'];
const SORT_FIELDS: readonly AdminUserSortField[] = ['fullName', 'email', 'status', 'lastLoginAt'];
const SORT_DIRECTIONS: readonly AdminSortDirection[] = ['asc', 'desc'];

export class ListAdminUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listAdminUsersQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listAdminUsersQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listAdminUsersQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listAdminUsersQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listAdminUsersQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @MaxLength(200, { message: USER_MESSAGES.dto.listAdminUsersQuery.q.maxLength })
  q?: string;

  @IsOptional()
  @IsIn(STATUS_VALUES, { message: USER_MESSAGES.dto.listAdminUsersQuery.status.isIn })
  status?: UserStatus;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.listAdminUsersQuery.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.listAdminUsersQuery.roleId.isUuid })
  roleId?: string;

  @IsOptional()
  @IsIn(SORT_FIELDS, { message: USER_MESSAGES.dto.listAdminUsersQuery.sort.isIn })
  sort: AdminUserSortField = 'fullName';

  @IsOptional()
  @IsIn(SORT_DIRECTIONS, { message: USER_MESSAGES.dto.listAdminUsersQuery.direction.isIn })
  direction: AdminSortDirection = 'asc';
}
