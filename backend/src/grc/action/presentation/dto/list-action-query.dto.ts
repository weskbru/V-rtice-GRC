import { ActionOriginType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ActionStatus } from '@prisma/client';

const ACTION_STATUS_VALUES: readonly ActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const ACTION_ORIGIN_TYPE_VALUES: readonly ActionOriginType[] = Object.values(ActionOriginType);

function toBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const raw = obj[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

export class ListActionQueryDto {
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
  @IsIn(ACTION_STATUS_VALUES, { message: USER_MESSAGES.dto.actionListQuery.status.isIn })
  status?: ActionStatus;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.actionListQuery.responsibleUserId.isUuid })
  responsibleUserId?: string;

  @IsOptional()
  @IsIn(ACTION_ORIGIN_TYPE_VALUES, { message: USER_MESSAGES.dto.actionListQuery.originType.isIn })
  originType?: ActionOriginType;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.actionListQuery.originId.isUuid })
  originId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: USER_MESSAGES.dto.actionListQuery.overdue.isBoolean })
  overdue?: boolean;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.actionListQuery.dueBefore.isDateString })
  dueBefore?: string;
}
