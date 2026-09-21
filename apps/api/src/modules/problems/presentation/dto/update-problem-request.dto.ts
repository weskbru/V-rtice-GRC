/**
 * 008-incidents-problems, US2 — matches
 * `contracts/problems.openapi.yaml`'s `UpdateProblemRequest` exactly:
 * `minProperties: 1` is enforced at the controller
 * (`assertUpdateBodyNotEmpty`, mirroring `finding.controller.ts`'s own
 * function). **`status`/`orgUnitId`/`rootCause` are deliberately not
 * declared here at all** — not declaring them IS the rejection, via the
 * global `ValidationPipe`'s `forbidNonWhitelisted`.
 */
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
