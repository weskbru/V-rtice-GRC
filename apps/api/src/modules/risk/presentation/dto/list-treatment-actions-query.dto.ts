/**
 * T143 — matches `GET /risks/{riskId}/treatment-actions`'s query parameters
 * (`contracts/risks.openapi.yaml`'s `listRiskTreatmentActions`): `page`,
 * `pageSize`, comma-separated `status` (`style: form, explode: false`, same
 * `splitCsv` pattern `ListRisksQueryDto` establishes), and `overdue`.
 */
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ActionStatus } from '@prisma/client';

// 007-implementation-remediation, Frente A, D-1 — validates against
// `ActionStatus` now (`Action` is the sole authority); same four values as
// the retired `TreatmentActionStatus`.
const TREATMENT_ACTION_STATUS_VALUES: readonly ActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

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

export class ListTreatmentActionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.treatmentAction.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.treatmentAction.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.treatmentAction.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.treatmentAction.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.treatmentAction.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(TREATMENT_ACTION_STATUS_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.treatmentAction.status.isIn,
  })
  status?: ActionStatus[];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: USER_MESSAGES.dto.treatmentAction.overdue.isBoolean })
  overdue?: boolean;
}
