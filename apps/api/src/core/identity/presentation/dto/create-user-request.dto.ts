/**
 * T180 — matches `contracts/admin.openapi.yaml`'s `CreateUserRequest`
 * exactly (`additionalProperties: false`). Reuses
 * `GrantOrgScopeRequestDto` (`core/organizations/presentation`) for
 * `scopeGrants` rather than a second, identical DTO class —
 * cross-capability `core-presentation` imports are unrestricted by the
 * ADR-011 boundary rules (`apps/api/eslint.config.mjs`'s own comment).
 */
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { GrantOrgScopeRequestDto } from '../../../organizations/presentation/dto/grant-org-scope-request.dto';

export class CreateUserRequestDto {
  @IsEmail({}, { message: USER_MESSAGES.dto.adminUser.email.isEmail })
  @MaxLength(320, { message: USER_MESSAGES.dto.adminUser.email.maxLength })
  email!: string;

  @IsString({ message: USER_MESSAGES.dto.adminUser.fullName.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.adminUser.fullName.length })
  fullName!: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.adminUser.jobTitle.isString })
  @MaxLength(200, { message: USER_MESSAGES.dto.adminUser.jobTitle.maxLength })
  jobTitle?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.adminUser.primaryOrgUnitId.isUuid })
  primaryOrgUnitId?: string | null;

  @IsString({ message: USER_MESSAGES.dto.adminUser.initialPassword.isString })
  @Length(12, 256, { message: USER_MESSAGES.dto.adminUser.initialPassword.length })
  initialPassword!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true, message: USER_MESSAGES.dto.adminUser.roleIds.isUuid })
  roleIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrantOrgScopeRequestDto)
  scopeGrants?: GrantOrgScopeRequestDto[];
}
