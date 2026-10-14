import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { FindingSeverity, FindingStatus } from '@prisma/client';

const FINDING_STATUS_VALUES: readonly FindingStatus[] = [
  'OPEN',
  'IN_REMEDIATION',
  'CLOSED',
  'ARCHIVED',
];

const FINDING_SEVERITY_VALUES: readonly FindingSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function toBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const raw = obj[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

export class ListFindingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.findingListQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.findingListQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.findingListQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.findingListQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.findingListQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsIn(FINDING_STATUS_VALUES, { message: USER_MESSAGES.dto.findingListQuery.status.isIn })
  status?: FindingStatus;

  @IsOptional()
  @IsIn(FINDING_SEVERITY_VALUES, { message: USER_MESSAGES.dto.findingListQuery.severity.isIn })
  severity?: FindingSeverity;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.findingListQuery.ownerUserId.isUuid })
  ownerUserId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.findingListQuery.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: USER_MESSAGES.dto.findingListQuery.withoutRemediation.isBoolean })
  withoutRemediation?: boolean;
}
