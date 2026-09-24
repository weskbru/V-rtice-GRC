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
  AssetCatalogSortDirection,
  AssetCatalogSortField,
} from '../../domain/ports/asset-repository.port';

const SORT_FIELD_VALUES: readonly AssetCatalogSortField[] = ['code', 'name', 'updatedAt'];
const SORT_DIRECTION_VALUES: readonly AssetCatalogSortDirection[] = ['asc', 'desc'];

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

export class ListAssetsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listAssetsQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listAssetsQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listAssetsQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listAssetsQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listAssetsQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: USER_MESSAGES.dto.listAssetsQuery.q.maxLength })
  q?: string;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsUUID(undefined, { each: true, message: USER_MESSAGES.dto.listAssetsQuery.orgUnitId.isUuid })
  orgUnitId?: string[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(SORT_FIELD_VALUES, { message: USER_MESSAGES.dto.listAssetsQuery.sort.isIn })
  sort: AssetCatalogSortField = 'code';

  @IsOptional()
  @IsIn(SORT_DIRECTION_VALUES, { message: USER_MESSAGES.dto.listAssetsQuery.direction.isIn })
  direction: AssetCatalogSortDirection = 'asc';
}
