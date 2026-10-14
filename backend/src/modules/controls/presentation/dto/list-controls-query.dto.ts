import { Transform, Type } from 'class-transformer';
import {
  IsArray,
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

import type { ControlEffectiveness } from '../../domain/control-effectiveness.service';
import type {
  ControlCatalogSortDirection,
  ControlCatalogSortField,
} from '../../domain/ports/control-query.port';
import type { ControlFrequency, ControlNature, ControlStatus, ControlType } from '@prisma/client';

const CONTROL_STATUS_VALUES: readonly ControlStatus[] = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED'];

const CONTROL_EFFECTIVENESS_VALUES: readonly ControlEffectiveness[] = [
  'NOT_ASSESSED',
  'EFFECTIVE',
  'PARTIALLY_EFFECTIVE',
  'INEFFECTIVE',
  'EXPIRED',
];

const CONTROL_NATURE_VALUES: readonly ControlNature[] = ['MANUAL', 'AUTOMATED'];
const CONTROL_TYPE_VALUES: readonly ControlType[] = ['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE'];
const CONTROL_FREQUENCY_VALUES: readonly ControlFrequency[] = [
  'CONTINUOUS',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
];

const SORT_FIELD_VALUES: readonly ControlCatalogSortField[] = [
  'code',
  'name',
  'status',
  'effectiveness',
  'owner',
  'updatedAt',
];

const SORT_DIRECTION_VALUES: readonly ControlCatalogSortDirection[] = ['asc', 'desc'];

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

export class ListControlsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.controlCatalogQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.controlCatalogQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.controlCatalogQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.controlCatalogQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.controlCatalogQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: USER_MESSAGES.dto.controlCatalogQuery.q.maxLength })
  q?: string;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(CONTROL_STATUS_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.controlCatalogQuery.status.isIn,
  })
  status?: ControlStatus[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(CONTROL_EFFECTIVENESS_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.controlCatalogQuery.effectiveness.isIn,
  })
  effectiveness?: ControlEffectiveness[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(CONTROL_NATURE_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.controlCatalogQuery.nature.isIn,
  })
  nature?: ControlNature[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(CONTROL_TYPE_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.controlCatalogQuery.type.isIn,
  })
  type?: ControlType[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(CONTROL_FREQUENCY_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.controlCatalogQuery.frequency.isIn,
  })
  frequency?: ControlFrequency[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsUUID(undefined, {
    each: true,
    message: USER_MESSAGES.dto.controlCatalogQuery.orgUnitId.isUuid,
  })
  orgUnitId?: string[];

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsUUID(undefined, {
    each: true,
    message: USER_MESSAGES.dto.controlCatalogQuery.ownerUserId.isUuid,
  })
  ownerUserId?: string[];

  @IsOptional()
  @IsIn(SORT_FIELD_VALUES, { message: USER_MESSAGES.dto.controlCatalogQuery.sort.isIn })
  sort: ControlCatalogSortField = 'code';

  @IsOptional()
  @IsIn(SORT_DIRECTION_VALUES, { message: USER_MESSAGES.dto.controlCatalogQuery.direction.isIn })
  direction: ControlCatalogSortDirection = 'asc';
}
