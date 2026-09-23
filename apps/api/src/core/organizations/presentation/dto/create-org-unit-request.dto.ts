import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateOrgUnitRequestDto {
  @IsString({ message: USER_MESSAGES.dto.writeOrgUnit.code.isString })
  @Length(1, 50, { message: USER_MESSAGES.dto.writeOrgUnit.code.length })
  code!: string;

  @IsString({ message: USER_MESSAGES.dto.writeOrgUnit.name.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.writeOrgUnit.name.length })
  name!: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.writeOrgUnit.parentId.isUuid })
  parentId?: string | null;
}
