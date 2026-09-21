/**
 * T107 — matches `GET /risks`'s query parameters exactly
 * (`contracts/risks.openapi.yaml`'s `listRiskRegister` operation).
 *
 * `@Type(() => Number)`/explicit `@Transform` on booleans follow the exact
 * pattern already established by `ListDirectoryUsersQueryDto` (T095b) and
 * `ReferenceDataQueryDto` (T095a) — see those files' headers for why
 * `enableImplicitConversion` alone is not relied on for numbers/booleans.
 *
 * Comma-separated array parameters (`status`, `riskLevel`, `categoryId`,
 * `orgUnitId`, `ownerUserId`) use `style: form, explode: false` per the
 * OpenAPI document — a single query-string value split on `,` — the first
 * such parameters in this codebase, so `splitCsv` below is this file's own
 * small, local transform rather than a shared primitive invented ahead of
 * a second consumer (CLAUDE.md: "não criar abstrações prematuras").
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

/**
 * Reads `obj[key]` — the UNTOUCHED raw query value — never the `value`
 * argument.
 *
 * The global `ValidationPipe` runs with `enableImplicitConversion: true`,
 * which coerces a field reflected as `boolean` via `Boolean(rawString)`
 * BEFORE any `@Transform` runs. `Boolean('false')` is a non-empty string,
 * so it is already `true` by the time a `@Transform(({ value }) => ...)`
 * receives it: an explicit `?flag=false` was silently read as `true`.
 *
 * Reproduced directly against this exact `class-transformer` version
 * before the fix (`plainToInstance(Dto, { flag: 'false' },
 * { enableImplicitConversion: true })` yielded `true`) and after it
 * (yields `false`). `apps/api/test/unit/query-boolean-coercion.spec.ts`
 * holds that reproduction for every DTO sharing this shape, so the pattern
 * cannot come back one file at a time — it was present in seven of them.
 */
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
