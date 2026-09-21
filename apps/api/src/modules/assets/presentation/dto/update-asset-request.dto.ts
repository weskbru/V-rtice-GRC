/**
 * T022/006-assets-processes — matches `contracts/assets.openapi.yaml`'s
 * `UpdateAssetRequest`: every property optional (partial update),
 * `additionalProperties: false`, `minProperties: 1` enforced by the
 * controller (see `asset.controller.ts`, mirroring
 * `UpdateControlRequestDto`'s identical convention).
 */
import { IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateAssetRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.asset.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.asset.name.length })
  name?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.asset.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.asset.description.minLength })
  description?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.asset.orgUnitId.isUuid })
  orgUnitId?: string;
}
