/**
 * 008-incidents-problems, US2 — matches
 * `contracts/problems.openapi.yaml`'s `TransitionProblemRequest` exactly.
 * Which of `rootCause`/`cancellationReason`/`reopenReason` is actually
 * REQUIRED depends on `toStatus` (data-model.md §4, Invariants P1/P2/P3)
 * — enforced by `problem.entity.ts`'s domain assertions, not here; this
 * DTO only validates the SHAPE of whichever fields are present.
 */
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

  /** Required when `toStatus: RESOLVED` (Invariant P1). */
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.problemTransition.rootCause.isString })
  @MaxLength(4000, { message: USER_MESSAGES.dto.problemTransition.rootCause.maxLength })
  rootCause?: string;

  /** Required when `toStatus: CANCELLED`. */
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.problemTransition.cancellationReason.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.problemTransition.cancellationReason.maxLength })
  cancellationReason?: string;

  /** Required when reopening (`RESOLVED -> IN_ANALYSIS`). */
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.problemTransition.reopenReason.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.problemTransition.reopenReason.maxLength })
  reopenReason?: string;
}
