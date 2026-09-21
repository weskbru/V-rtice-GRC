/**
 * T022/006-assets-processes — matches `GET /assets`'s query parameters
 * exactly (`contracts/assets.openapi.yaml`'s `listAssetCatalog` operation).
 * Comma-separated array parameters use `style: form, explode: false` per
 * the OpenAPI document — mirrors `ListControlsQueryDto`'s own `splitCsv`
 * convention exactly.
 */
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

/**
 * `enableImplicitConversion: true` (the platform's global
 * `ValidationPipe`, `infrastructure/http/validation.ts`) resolves this
 * property's reflected TypeScript type (`boolean`) and coerces the RAW
 * query string via `Boolean(rawValue)` BEFORE any `@Transform` runs — so
 * `Boolean('false')` (a non-empty string) already evaluates to `true` by
 * the time a naive `@Transform(({ value }) => ...)` would receive it,
 * silently discarding an explicit `isActive=false` (verified against this
 * exact `class-transformer` version's `TransformOperationExecutor`: the
 * implicit, reflected-type conversion runs first, and `applyCustomTransformations`
 * hands a custom `@Transform` the ALREADY-coerced value, not the original
 * string). Reading `obj[key]` — the untouched raw plain object — instead
 * of the corrupted `value` is what makes `false` distinguishable from
 * `true` here; a version keyed on `value` alone would report FR-007's
 * `isActive=false` filter as "no rows" for every genuinely inactive
 * asset, which is exactly the regression this comment exists to prevent
 * from being "fixed" back into the naive form. */
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
