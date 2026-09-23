import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ProblemListSortField } from '../../domain/ports/problem-repository.port';
import type { ProblemSeverity, ProblemStatus } from '@prisma/client';

const PROBLEM_STATUS_VALUES: readonly ProblemStatus[] = [
  'OPEN',
  'IN_ANALYSIS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

const PROBLEM_SEVERITY_VALUES: readonly ProblemSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const SORT_FIELD_VALUES: readonly ProblemListSortField[] = [
  'code',
  'title',
  'severity',
  'status',
  'identifiedOn',
  'updatedAt',
];

function toArray({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const raw = obj[key];
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw : [raw];
}

export class ListProblemsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.problemCatalogQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.problemCatalogQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.problemCatalogQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.problemCatalogQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.problemCatalogQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(PROBLEM_STATUS_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.problemCatalogQuery.status.isIn,
  })
  status?: readonly ProblemStatus[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(PROBLEM_SEVERITY_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.problemCatalogQuery.severity.isIn,
  })
  severity?: readonly ProblemSeverity[];

  @IsOptional()
  @MaxLength(200, { message: USER_MESSAGES.dto.problemCatalogQuery.search.maxLength })
  search?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.problemCatalogQuery.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @IsIn(SORT_FIELD_VALUES, { message: USER_MESSAGES.dto.problemCatalogQuery.sort.isIn })
  sort: ProblemListSortField = 'identifiedOn';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: USER_MESSAGES.dto.problemCatalogQuery.direction.isIn })
  direction: 'asc' | 'desc' = 'asc';
}
