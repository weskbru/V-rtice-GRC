import { IsArray, IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ReplaceUserRolesRequestDto {
  @IsArray()
  @IsUUID(undefined, { each: true, message: USER_MESSAGES.dto.replaceUserRoles.roleIds.isUuid })
  roleIds!: string[];
}
