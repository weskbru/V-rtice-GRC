import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import { PageQueryDto } from './page-query.dto';

export class ListRiskAuditEventsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: USER_MESSAGES.dto.riskAuditEventsQuery.action.maxLength })
  action?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.riskAuditEventsQuery.actorUserId.isUuid })
  actorUserId?: string;

  @IsOptional()
  @IsDateString(undefined, {
    message: USER_MESSAGES.dto.riskAuditEventsQuery.occurredFrom.isDateString,
  })
  occurredFrom?: string;

  @IsOptional()
  @IsDateString(undefined, {
    message: USER_MESSAGES.dto.riskAuditEventsQuery.occurredTo.isDateString,
  })
  occurredTo?: string;
}
