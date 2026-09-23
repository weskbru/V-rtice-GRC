import { IsDateString, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateAuditEngagementRequestDto {
  @IsString({ message: USER_MESSAGES.dto.auditEngagement.objective.isString })
  @Length(1, 2000, { message: USER_MESSAGES.dto.auditEngagement.objective.length })
  objective!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.auditEngagement.periodStart.isDateString })
  periodStart!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.auditEngagement.periodEnd.isDateString })
  periodEnd!: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.auditEngagement.orgUnitId.isUuid })
  orgUnitId!: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.auditEngagement.leadAuditorUserId.isUuid })
  leadAuditorUserId!: string;
}
