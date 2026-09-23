import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class AddFrameworkVersionScopeRequestDto {
  @IsUUID(undefined, {
    message: USER_MESSAGES.dto.addFrameworkVersionScope.frameworkVersionId.isUuid,
  })
  frameworkVersionId!: string;
}
