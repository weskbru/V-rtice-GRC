import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class AddControlScopeRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.addControlScope.controlId.isUuid })
  controlId!: string;
}
