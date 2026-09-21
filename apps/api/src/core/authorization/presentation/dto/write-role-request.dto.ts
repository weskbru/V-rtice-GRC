/**
 * T180 — matches `contracts/admin.openapi.yaml`'s `WriteRoleRequest`
 * exactly (`additionalProperties: false`). `permissionIdentifiers` are
 * plain strings (`resource:action`), not UUIDs — validated against the
 * real permission catalogue by `RoleAdminService`, not by shape here.
 */
import { ArrayUnique, IsArray, IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class WriteRoleRequestDto {
  @IsString({ message: USER_MESSAGES.dto.writeRole.name.isString })
  @Length(1, 100, { message: USER_MESSAGES.dto.writeRole.name.length })
  name!: string;

  @IsString({ message: USER_MESSAGES.dto.writeRole.description.isString })
  @Length(1, 500, { message: USER_MESSAGES.dto.writeRole.description.length })
  description!: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true, message: USER_MESSAGES.dto.writeRole.permissionIdentifiers.isString })
  permissionIdentifiers!: string[];
}
