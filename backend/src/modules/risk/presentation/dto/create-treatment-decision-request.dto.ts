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
