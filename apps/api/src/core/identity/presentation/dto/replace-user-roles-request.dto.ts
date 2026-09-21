/**
 * T180 — matches `contracts/admin.openapi.yaml`'s
 * `ReplaceUserRolesRequest` (`additionalProperties: false`). An empty
 * array is a legal value ("An empty array removes all roles") —
 * `@IsArray()` alone, no `@ArrayMinSize`.
 */
import { IsArray, IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ReplaceUserRolesRequestDto {
  @IsArray()
  @IsUUID(undefined, { each: true, message: USER_MESSAGES.dto.replaceUserRoles.roleIds.isUuid })
  roleIds!: string[];
}
