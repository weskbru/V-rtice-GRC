import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkEntityRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.link.id.isUuid })
  id!: string;
}
