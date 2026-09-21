/**
 * T022/006-assets-processes — matches `contracts/assets.openapi.yaml`'s
 * `CreateAssetRequest` exactly: `additionalProperties: false` (global
 * `ValidationPipe`'s `forbidNonWhitelisted`) means this class is also, by
 * construction, where "code/isActive are server-owned and rejected as
 * unknown properties" (Invariant A6) is enforced — not declaring the
 * property IS the rejection, the same discipline
 * `CreateControlRequestDto`'s own header documents.
 */
import { IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateAssetRequestDto {
  @IsString({ message: USER_MESSAGES.dto.asset.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.asset.name.length })
  name!: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.asset.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.asset.description.minLength })
  description?: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.asset.orgUnitId.isUuid })
  orgUnitId!: string;
}
