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
