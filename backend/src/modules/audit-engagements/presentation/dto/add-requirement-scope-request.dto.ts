import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class AddRequirementScopeRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.addRequirementScope.requirementId.isUuid })
  requirementId!: string;
}
