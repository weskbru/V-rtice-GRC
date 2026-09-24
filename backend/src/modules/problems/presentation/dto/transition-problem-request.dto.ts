import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ProblemStatus } from '@prisma/client';

const PROBLEM_STATUS_VALUES: readonly ProblemStatus[] = [
  'OPEN',
  'IN_ANALYSIS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

export class TransitionProblemRequestDto {
  @IsIn(PROBLEM_STATUS_VALUES, { message: USER_MESSAGES.dto.problemTransition.toStatus.isIn })
  toStatus!: ProblemStatus;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.problemTransition.rootCause.isString })
  @MaxLength(4000, { message: USER_MESSAGES.dto.problemTransition.rootCause.maxLength })
  rootCause?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.problemTransition.cancellationReason.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.problemTransition.cancellationReason.maxLength })
  cancellationReason?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.problemTransition.reopenReason.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.problemTransition.reopenReason.maxLength })
  reopenReason?: string;
}
