/**
 * T022/006-assets-processes — matches `contracts/processes.openapi.yaml`'s
 * `CreateProcessRequest` exactly. Identical in shape to
 * `modules/assets/presentation/dto/create-asset-request.dto.ts` (FR-020).
 */
import { IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateProcessRequestDto {
  @IsString({ message: USER_MESSAGES.dto.process.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.process.name.length })
  name!: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.process.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.process.description.minLength })
  description?: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.process.orgUnitId.isUuid })
  orgUnitId!: string;
}
