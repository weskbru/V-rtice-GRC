/**
 * T167/US7 — matches `GET /risks/{riskId}/history`'s query parameters
 * (`contracts/risks.openapi.yaml`'s `getRiskHistory` operation): `page`,
 * `pageSize` (inherited from `PageQueryDto`) plus `type`, a comma-separated
 * `RiskHistoryEntryType[]` filter (`style: form, explode: false`, same
 * `splitCsv` transform `ListRisksQueryDto` established for this shape).
 */
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import { PageQueryDto } from './page-query.dto';

import type { RiskHistoryEntryType } from '../../domain/ports/risk-history-query.port';

/** Every value this task's `RiskHistoryQueryService` can actually produce
 * (`RiskHistoryQueryPort`'s own header explains why this is a subset of
 * `contracts/risks.openapi.yaml`'s full `RiskHistoryEntryType` enum). */
const RISK_HISTORY_ENTRY_TYPE_VALUES: readonly RiskHistoryEntryType[] = [
  'ASSESSMENT',
  'OWNERSHIP_CHANGE',
  'TREATMENT_DECISION',
  'LIFECYCLE_TRANSITION',
  'APPROVAL',
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

export class ListRiskHistoryQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(splitCsv)
  @IsArray()
  @IsIn(RISK_HISTORY_ENTRY_TYPE_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.riskHistoryQuery.type.isIn,
  })
  type?: RiskHistoryEntryType[];
}
