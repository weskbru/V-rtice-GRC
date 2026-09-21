/**
 * T030/004-compliance-management — matches `GET /frameworks`'s query
 * parameters exactly (`contracts/compliance.openapi.yaml`'s
 * `listFrameworks` operation). Comma-separated array parameters use
 * `style: form, explode: false`, mirroring `ListControlsQueryDto`'s own
 * `splitCsv` convention exactly.
 */
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type {
  FrameworkListSortDirection,
  FrameworkListSortField,
} from '../../domain/ports/framework-repository.port';
import type { FrameworkOrigin } from '@prisma/client';

const FRAMEWORK_ORIGIN_VALUES: readonly FrameworkOrigin[] = [
  'EXTERNAL_STANDARD',
  'INTERNAL_POLICY',
];
const SORT_FIELD_VALUES: readonly FrameworkListSortField[] = ['code', 'name', 'updatedAt'];
const SORT_DIRECTION_VALUES: readonly FrameworkListSortDirection[] = ['asc', 'desc'];

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

export class ListFrameworksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listFrameworksQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listFrameworksQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listFrameworksQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listFrameworksQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listFrameworksQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: USER_MESSAGES.dto.listFrameworksQuery.q.maxLength })
  q?: string;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(FRAMEWORK_ORIGIN_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.listFrameworksQuery.origin.isIn,
  })
  origin?: FrameworkOrigin[];

  @IsOptional()
  @IsIn(SORT_FIELD_VALUES, { message: USER_MESSAGES.dto.listFrameworksQuery.sort.isIn })
  sort: FrameworkListSortField = 'code';

  @IsOptional()
  @IsIn(SORT_DIRECTION_VALUES, { message: USER_MESSAGES.dto.listFrameworksQuery.direction.isIn })
  direction: FrameworkListSortDirection = 'asc';
}
