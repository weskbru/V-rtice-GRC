/**
 * T053/002-shared-grc-foundation, US2 — matches `GET /actions`'s query
 * parameters (`contracts/grc-foundation.openapi.yaml`'s `listActions`
 * operation) exactly. Follows `ListEvidenceQueryDto`'s own established
 * pattern for the page/pageSize pair and boolean-from-querystring coercion.
 *
 * `ACTION_ORIGIN_TYPE_VALUES` is DERIVED from `ActionOriginType`, not
 * hand-restated — see `create-action-request.dto.ts`'s header for the
 * full account (coordinator finding, 2026-09-11): a second hand-typed copy
 * of this same enum, sitting right next to the one that was found broken,
 * would have been the third file agreeing by coincidence rather than by
 * construction.
 */
import { ActionOriginType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ActionStatus } from '@prisma/client';

const ACTION_STATUS_VALUES: readonly ActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const ACTION_ORIGIN_TYPE_VALUES: readonly ActionOriginType[] = Object.values(ActionOriginType);

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

export class ListActionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.actionListQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.actionListQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.actionListQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.actionListQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.actionListQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsIn(ACTION_STATUS_VALUES, { message: USER_MESSAGES.dto.actionListQuery.status.isIn })
  status?: ActionStatus;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.actionListQuery.responsibleUserId.isUuid })
  responsibleUserId?: string;

  @IsOptional()
  @IsIn(ACTION_ORIGIN_TYPE_VALUES, { message: USER_MESSAGES.dto.actionListQuery.originType.isIn })
  originType?: ActionOriginType;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.actionListQuery.originId.isUuid })
  originId?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: USER_MESSAGES.dto.actionListQuery.overdue.isBoolean })
  overdue?: boolean;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.actionListQuery.dueBefore.isDateString })
  dueBefore?: string;
}
