import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ListActionAuditEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.actionListQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.actionListQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.actionListQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.actionListQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.actionListQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: USER_MESSAGES.dto.actionAuditEventsQuery.action.maxLength })
  action?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.actionAuditEventsQuery.actorUserId.isUuid })
  actorUserId?: string;

  @IsOptional()
  @IsDateString(undefined, {
    message: USER_MESSAGES.dto.actionAuditEventsQuery.occurredFrom.isDateString,
  })
  occurredFrom?: string;

  @IsOptional()
  @IsDateString(undefined, {
    message: USER_MESSAGES.dto.actionAuditEventsQuery.occurredTo.isDateString,
  })
  occurredTo?: string;
}
