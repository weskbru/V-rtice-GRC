/**
 * T053/002-shared-grc-foundation, US2 — matches
 * `contracts/grc-foundation.openapi.yaml`'s `TransitionActionRequest`
 * exactly. `reason` is optional at the DTO/shape level (`400`) — its
 * REQUIREDNESS when `to = OPEN` is a business rule (Invariant A2),
 * enforced at `422` by `action.entity.ts#assertReopenReasonProvided`, not
 * here (the same `400`-shape/`422`-business-rule split every other
 * invariant in this feature follows).
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ActionStatus } from '@prisma/client';

const ACTION_STATUS_VALUES: readonly ActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export class TransitionActionRequestDto {
  @IsIn(ACTION_STATUS_VALUES, { message: USER_MESSAGES.dto.actionTransition.to.isIn })
  to!: ActionStatus;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.actionTransition.reason.maxLength })
  @MaxLength(1000, { message: USER_MESSAGES.dto.actionTransition.reason.maxLength })
  reason?: string;
}
