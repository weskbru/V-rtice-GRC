/**
 * T143 — matches `contracts/risks.openapi.yaml`'s
 * `CreateRiskTreatmentDecisionRequest` exactly: `additionalProperties: false`
 * (global `ValidationPipe`'s `forbidNonWhitelisted`) means the deciding
 * user and timestamp — never declared here — cannot be supplied by a
 * caller (FR-072: "taken from the session, never from the request body").
 */
import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { TreatmentStrategy } from '@prisma/client';

const TREATMENT_STRATEGY_VALUES: readonly TreatmentStrategy[] = [
  'MITIGATE',
  'AVOID',
  'TRANSFER',
  'ACCEPT',
];

export class CreateRiskTreatmentDecisionRequestDto {
  @IsIn(TREATMENT_STRATEGY_VALUES, {
    message: USER_MESSAGES.dto.treatmentDecision.strategy.isIn,
  })
  strategy!: TreatmentStrategy;

  @IsString({ message: USER_MESSAGES.dto.treatmentDecision.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.treatmentDecision.description.minLength })
  description!: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.treatmentDecision.deadline.isDateString })
  deadline?: string | null;
}
