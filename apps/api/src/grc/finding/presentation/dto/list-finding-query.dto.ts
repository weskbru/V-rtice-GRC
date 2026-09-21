/**
 * T073/002-shared-grc-foundation, US3 — matches `GET /findings`'s query
 * parameters (`contracts/grc-foundation.openapi.yaml`'s `listFindings`
 * operation) exactly. Follows `ListActionQueryDto`'s own established
 * pattern for the page/pageSize pair and boolean-from-querystring
 * coercion.
 */
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { FindingSeverity, FindingStatus } from '@prisma/client';

const FINDING_STATUS_VALUES: readonly FindingStatus[] = [
  'OPEN',
  'IN_REMEDIATION',
  'CLOSED',
  'ARCHIVED',
];

const FINDING_SEVERITY_VALUES: readonly FindingSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

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

export class ListFindingQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.findingListQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.findingListQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.findingListQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.findingListQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.findingListQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsIn(FINDING_STATUS_VALUES, { message: USER_MESSAGES.dto.findingListQuery.status.isIn })
  status?: FindingStatus;

  @IsOptional()
  @IsIn(FINDING_SEVERITY_VALUES, { message: USER_MESSAGES.dto.findingListQuery.severity.isIn })
  severity?: FindingSeverity;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.findingListQuery.ownerUserId.isUuid })
  ownerUserId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.findingListQuery.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: USER_MESSAGES.dto.findingListQuery.withoutRemediation.isBoolean })
  withoutRemediation?: boolean;
}
