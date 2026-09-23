import { IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CancelAuditEngagementRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.cancelAuditEngagement.justification.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.cancelAuditEngagement.justification.length })
  justification?: string;
}
