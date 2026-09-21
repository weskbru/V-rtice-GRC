/**
 * 008-incidents-problems, US2 — matches
 * `contracts/problems.openapi.yaml`'s `CreateProblemRequest` exactly.
 * `additionalProperties: false` (the global `ValidationPipe`'s
 * `forbidNonWhitelisted`) means this class is also where a caller cannot
 * smuggle `code`/`status`/`rootCause`/`closedAt` past creation — not
 * declaring them here IS the rejection.
 */
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MinLength,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ProblemSeverity } from '@prisma/client';

const PROBLEM_SEVERITY_VALUES: readonly ProblemSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export class CreateProblemRequestDto {
  @IsString({ message: USER_MESSAGES.dto.problem.title.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.problem.title.length })
  title!: string;

  @IsString({ message: USER_MESSAGES.dto.problem.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.problem.description.minLength })
  description!: string;

  @IsIn(PROBLEM_SEVERITY_VALUES, { message: USER_MESSAGES.dto.problem.severity.isIn })
  severity!: ProblemSeverity;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.problem.orgUnitId.isUuid })
  orgUnitId!: string;

  /** Optional — defaults to the caller (`CreateProblemUseCase`'s own
   * doc comment). */
  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.problem.ownerUserId.isUuid })
  ownerUserId?: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.problem.identifiedOn.isDateString })
  identifiedOn!: string;
}
