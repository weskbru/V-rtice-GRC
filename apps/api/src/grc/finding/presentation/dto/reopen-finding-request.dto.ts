import { IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ReopenFindingRequestDto {
  @IsString({ message: USER_MESSAGES.dto.reopenFinding.reason.isString })
  @Length(1, 4000, { message: USER_MESSAGES.dto.reopenFinding.reason.length })
  reason!: string;
}
