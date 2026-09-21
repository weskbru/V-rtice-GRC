/**
 * T030/004-compliance-management — matches `GET
 * /frameworks/{frameworkId}/versions`'s query parameters exactly
 * (`contracts/compliance.openapi.yaml`'s `listFrameworkVersions`
 * operation).
 */
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { FrameworkVersionStatus } from '@prisma/client';

const FRAMEWORK_VERSION_STATUS_VALUES: readonly FrameworkVersionStatus[] = ['DRAFT', 'PUBLISHED'];

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

export class ListFrameworkVersionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listFrameworkVersionsQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listFrameworkVersionsQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listFrameworkVersionsQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listFrameworkVersionsQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listFrameworkVersionsQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(FRAMEWORK_VERSION_STATUS_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.listFrameworkVersionsQuery.status.isIn,
  })
  status?: FrameworkVersionStatus[];
}
