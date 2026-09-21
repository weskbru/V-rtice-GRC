/**
 * 007-implementation-remediation, Frente A, D-3 — matches
 * `contracts/risks.openapi.yaml`'s `UpdateRiskTreatmentActionRequest`:
 * every property optional (partial update), `additionalProperties: false`,
 * `minProperties: 1` (enforced in the controller — see
 * `treatment.controller.ts`'s `assertUpdateBodyNotEmpty`).
 *
 * `status` now validates against `ActionStatus` (D-1: `Action` is the sole
 * authority) — same four values as the retired `TreatmentActionStatus`,
 * confirmed identical in `schema.prisma`. `reopenReason` is new
 * (contracts/contract-changes.md §1.3): required when `status: OPEN`
 * reopens a `COMPLETED` action, enforced once in
 * `action.entity.ts#assertReopenReasonProvided` — this DTO only checks its
 * type. `treatmentDecisionId` is new too: sets or clears the link row's own
 * field, upserting the link row if the action has none yet (D-1/D-2).
 */
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ActionStatus } from '@prisma/client';

const ACTION_STATUS_VALUES: readonly ActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export class UpdateRiskTreatmentActionRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.treatmentAction.title.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.treatmentAction.title.length })
  title?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.treatmentAction.description.isString })
  description?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.treatmentAction.responsibleUserId.isUuid })
  responsibleUserId?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.treatmentAction.dueOn.isDateString })
  dueOn?: string;

  @IsOptional()
  @IsIn(ACTION_STATUS_VALUES, { message: USER_MESSAGES.dto.treatmentAction.status.isIn })
  status?: ActionStatus;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.treatmentAction.reopenReason.isString })
  reopenReason?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.treatmentAction.treatmentDecisionId.isUuid })
  treatmentDecisionId?: string | null;
}
