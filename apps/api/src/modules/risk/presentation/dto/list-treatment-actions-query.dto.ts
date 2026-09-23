import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ActionStatus } from '@prisma/client';

const TREATMENT_ACTION_STATUS_VALUES: readonly ActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

function splitCsv({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : undefined;
}

function toBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const raw = obj[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

export class ListTreatmentActionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.treatmentAction.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.treatmentAction.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.treatmentAction.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.treatmentAction.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.treatmentAction.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(TREATMENT_ACTION_STATUS_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.treatmentAction.status.isIn,
  })
  status?: ActionStatus[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: USER_MESSAGES.dto.treatmentAction.overdue.isBoolean })
  overdue?: boolean;
}
