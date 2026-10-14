import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkRequirementControlRequestDto {
  @IsUUID('all', { message: USER_MESSAGES.dto.linkRequirementControl.controlId.isUuid })
  controlId!: string;
}
