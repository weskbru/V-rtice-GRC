import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateFindingControlLinkRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.linkFindingControl.controlId.isUuid })
  controlId!: string;
}
