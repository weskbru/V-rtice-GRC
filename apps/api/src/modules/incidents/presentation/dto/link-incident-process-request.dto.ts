import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkIncidentProcessRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.linkIncidentProcess.processId.isUuid })
  processId!: string;
}
