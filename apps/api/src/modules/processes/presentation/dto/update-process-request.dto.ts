import { IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateProcessRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.process.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.process.name.length })
  name?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.process.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.process.description.minLength })
  description?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.process.orgUnitId.isUuid })
  orgUnitId?: string;
}
