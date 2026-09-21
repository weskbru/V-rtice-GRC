/**
 * 009-indicators-reports, Fase 3 (T031) — matches `GET /indicators`'s query
 * parameters (`contracts/indicators.openapi.yaml`'s
 * `listIndicatorDefinitions` operation) exactly: `page`, `pageSize`
 * (default 20, per the contract's own `PageSize` parameter — NOT this
 * platform's more common default of 25), `isActive`.
 */
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

/** Mirrors `ListAssetsQueryDto`'s own `toBoolean` exactly — see that
 * file's header for why reading `obj[key]` (the untouched raw value)
 * rather than the already-implicitly-coerced `value` is what keeps an
 * explicit `isActive=false` from being read back as `true`. */
function toBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const raw = obj[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

export class ListIndicatorDefinitionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listIndicatorsQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listIndicatorsQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listIndicatorsQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listIndicatorsQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listIndicatorsQuery.pageSize.isInt })
  pageSize = 20;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
