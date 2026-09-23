import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type {
  RiskLevelBasis,
  RiskRegisterSortDirection,
  RiskRegisterSortField,
} from '../../domain/ports/risk-query.port';
import type { RiskLevel, RiskStatus } from '@prisma/client';

const RISK_STATUS_VALUES: readonly RiskStatus[] = [
  'DRAFT',
  'IDENTIFIED',
  'ASSESSED',
  'UNDER_TREATMENT',
  'UNDER_REVIEW',
  'ACCEPTED',
  'CLOSED',
  'ARCHIVED',
];

const RISK_LEVEL_VALUES: readonly RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const RISK_LEVEL_BASIS_VALUES: readonly RiskLevelBasis[] = ['RESIDUAL', 'INHERENT'];

const SORT_FIELD_VALUES: readonly RiskRegisterSortField[] = [
  'code',
  'title',
  'riskLevel',
  'status',
  'owner',
  'nextReviewOn',
  'identifiedOn',
  'updatedAt',
];

const SORT_DIRECTION_VALUES: readonly RiskRegisterSortDirection[] = ['asc', 'desc'];

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

export class ListRisksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.riskRegisterQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.riskRegisterQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.riskRegisterQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.riskRegisterQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.riskRegisterQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: USER_MESSAGES.dto.riskRegisterQuery.q.maxLength })
  q?: string;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(RISK_STATUS_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.riskRegisterQuery.status.isIn,
  })
  status?: RiskStatus[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(RISK_LEVEL_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.riskRegisterQuery.riskLevel.isIn,
  })
  riskLevel?: RiskLevel[];

  @IsOptional()
  @IsIn(RISK_LEVEL_BASIS_VALUES, {
    message: USER_MESSAGES.dto.riskRegisterQuery.riskLevelBasis.isIn,
  })
  riskLevelBasis: RiskLevelBasis = 'RESIDUAL';

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsUUID(undefined, {
    each: true,
    message: USER_MESSAGES.dto.riskRegisterQuery.categoryId.isUuid,
  })
  categoryId?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsUUID(undefined, {
    each: true,
    message: USER_MESSAGES.dto.riskRegisterQuery.orgUnitId.isUuid,
  })
  orgUnitId?: string[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: USER_MESSAGES.dto.riskRegisterQuery.includeDescendants.isBoolean })
  includeDescendants = true;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsUUID(undefined, {
    each: true,
    message: USER_MESSAGES.dto.riskRegisterQuery.ownerUserId.isUuid,
  })
  ownerUserId?: string[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: USER_MESSAGES.dto.riskRegisterQuery.overdueReview.isBoolean })
  overdueReview?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: USER_MESSAGES.dto.riskRegisterQuery.overdueTreatment.isBoolean })
  overdueTreatment?: boolean;

  @IsOptional()
  @IsIn(SORT_FIELD_VALUES, { message: USER_MESSAGES.dto.riskRegisterQuery.sort.isIn })
  sort: RiskRegisterSortField = 'code';

  @IsOptional()
  @IsIn(SORT_DIRECTION_VALUES, { message: USER_MESSAGES.dto.riskRegisterQuery.direction.isIn })
  direction: RiskRegisterSortDirection = 'asc';
}
