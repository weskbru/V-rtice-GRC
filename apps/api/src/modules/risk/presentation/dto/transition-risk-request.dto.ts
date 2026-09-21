/**
 * T158 — matches `contracts/risks.openapi.yaml`'s `TransitionRiskRequest`
 * exactly: `additionalProperties: false` (global `ValidationPipe`'s
 * `forbidNonWhitelisted`).
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { RiskStatus } from '@prisma/client';

const RISK_STATUS_VALUES: readonly RiskStatus[] = [
  'DRAFT',
  'IDENTIFIED',
  'ASSESSED',
  'UNDER_TREATMENT',
  'UNDER_REVIEW',
  'ACCEPTED',
  'CLOSED',
  'ARCHIVED',
];

export class TransitionRiskRequestDto {
  @IsIn(RISK_STATUS_VALUES, { message: USER_MESSAGES.dto.riskTransition.toStatus.isIn })
  toStatus!: RiskStatus;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.riskTransition.justification.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.riskTransition.justification.maxLength })
  justification?: string;
}
