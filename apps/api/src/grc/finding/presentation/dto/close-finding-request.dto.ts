import { IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CloseFindingRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.closeFinding.justification.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.closeFinding.justification.maxLength })
  justification?: string;
}
