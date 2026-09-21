/**
 * T180 — matches `contracts/admin.openapi.yaml`'s `SetUserStatusRequest`
 * (`additionalProperties: false`).
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { UserStatus } from '@prisma/client';

const STATUS_VALUES: readonly UserStatus[] = ['ACTIVE', 'INACTIVE'];

export class SetUserStatusRequestDto {
  @IsIn(STATUS_VALUES, { message: USER_MESSAGES.dto.setUserStatus.status.isIn })
  status!: UserStatus;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.setUserStatus.reason.isString })
  @MaxLength(500, { message: USER_MESSAGES.dto.setUserStatus.reason.maxLength })
  reason?: string;
}
