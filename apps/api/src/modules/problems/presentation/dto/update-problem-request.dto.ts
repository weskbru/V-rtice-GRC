import { IsIn, IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ProblemSeverity } from '@prisma/client';

const PROBLEM_SEVERITY_VALUES: readonly ProblemSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export class UpdateProblemRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.problem.title.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.problem.title.length })
  title?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.problem.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.problem.description.minLength })
  description?: string;

  @IsOptional()
  @IsIn(PROBLEM_SEVERITY_VALUES, { message: USER_MESSAGES.dto.problem.severity.isIn })
  severity?: ProblemSeverity;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.problem.ownerUserId.isUuid })
  ownerUserId?: string;
}
