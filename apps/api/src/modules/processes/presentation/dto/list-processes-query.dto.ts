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
  ProcessCatalogSortDirection,
  ProcessCatalogSortField,
} from '../../domain/ports/process-repository.port';

const SORT_FIELD_VALUES: readonly ProcessCatalogSortField[] = ['code', 'name', 'updatedAt'];
const SORT_DIRECTION_VALUES: readonly ProcessCatalogSortDirection[] = ['asc', 'desc'];

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

export class ListProcessesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listProcessesQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listProcessesQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listProcessesQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listProcessesQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listProcessesQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: USER_MESSAGES.dto.listProcessesQuery.q.maxLength })
  q?: string;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsUUID(undefined, { each: true, message: USER_MESSAGES.dto.listProcessesQuery.orgUnitId.isUuid })
  orgUnitId?: string[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(SORT_FIELD_VALUES, { message: USER_MESSAGES.dto.listProcessesQuery.sort.isIn })
  sort: ProcessCatalogSortField = 'code';

  @IsOptional()
  @IsIn(SORT_DIRECTION_VALUES, { message: USER_MESSAGES.dto.listProcessesQuery.direction.isIn })
  direction: ProcessCatalogSortDirection = 'asc';
}
