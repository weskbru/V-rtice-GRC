import { IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateAuditEngagementRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.auditEngagement.objective.isString })
  @Length(1, 2000, { message: USER_MESSAGES.dto.auditEngagement.objective.length })
  objective?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.auditEngagement.periodStart.isDateString })
  periodStart?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.auditEngagement.periodEnd.isDateString })
  periodEnd?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.auditEngagement.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.auditEngagement.leadAuditorUserId.isUuid })
  leadAuditorUserId?: string;
}
