import { ArrayUnique, IsArray, IsOptional, IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateRoleRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.writeRole.name.isString })
  @Length(1, 100, { message: USER_MESSAGES.dto.writeRole.name.length })
  name?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.writeRole.description.isString })
  @Length(1, 500, { message: USER_MESSAGES.dto.writeRole.description.length })
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true, message: USER_MESSAGES.dto.writeRole.permissionIdentifiers.isString })
  permissionIdentifiers?: string[];
}
