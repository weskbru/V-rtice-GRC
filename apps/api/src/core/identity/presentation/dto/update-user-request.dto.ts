/**
 * T180 — matches `contracts/admin.openapi.yaml`'s `UpdateUserRequest`:
 * every property optional, `additionalProperties: false`, `minProperties:
 * 1` — enforced in `AdminUsersController` itself, the same pattern
 * `UpdateRiskRequestDto`'s header documents.
 */
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateUserRequestDto {
  @IsOptional()
  @IsEmail({}, { message: USER_MESSAGES.dto.adminUser.email.isEmail })
  @MaxLength(320, { message: USER_MESSAGES.dto.adminUser.email.maxLength })
  email?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.adminUser.fullName.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.adminUser.fullName.length })
  fullName?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.adminUser.jobTitle.isString })
  @MaxLength(200, { message: USER_MESSAGES.dto.adminUser.jobTitle.maxLength })
  jobTitle?: string | null;

  @ValidateIf((_object, value: unknown) => value !== null && value !== undefined)
  @IsUUID(undefined, { message: USER_MESSAGES.dto.adminUser.primaryOrgUnitId.isUuid })
  primaryOrgUnitId?: string | null;
}
