/**
 * 008-incidents-problems, US2 — matches `GET /problems`'s query
 * parameters (`contracts/problems.openapi.yaml`'s `listProblems`
 * operation) exactly.
 *
 * `status`/`severity` use `style: form, explode: true` in the contract —
 * REPEATED query parameters (`?status=OPEN&status=CANCELLED`), not the
 * comma-separated `explode: false` convention every other list query in
 * this codebase uses (`ListControlsQueryDto`'s own header). Express/qs
 * already parses two repeated keys into an array, but a SINGLE occurrence
 * (`?status=OPEN`) parses as a bare string, not a one-element array — the
 * `toArray` transform below normalizes both shapes into an array, the
 * same class of coercion `toBoolean` in `list-finding-query.dto.ts`
 * documents needing (`enableImplicitConversion` alone does not solve this
 * for arrays either).
 */
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

/** Reads `obj[key]` — the raw query value — never `value` (see this
 * file's header for why). A single value becomes a one-element array; an
 * already-repeated parameter (already an array, courtesy of Express/qs)
 * passes through unchanged; an absent parameter stays `undefined`. */
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
