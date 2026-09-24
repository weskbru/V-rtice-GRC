import { IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ListPermissionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64, { message: USER_MESSAGES.dto.listPermissionsQuery.resource.maxLength })
  resource?: string;
}
