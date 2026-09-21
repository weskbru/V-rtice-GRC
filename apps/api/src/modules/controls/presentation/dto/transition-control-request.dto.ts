/**
 * T023/003-controls-management — matches `contracts/controls.openapi.yaml`'s
 * `TransitionControlRequest` exactly: `additionalProperties: false` (global
 * `ValidationPipe`'s `forbidNonWhitelisted`). `justification` is required
 * for `toStatus: RETIRED` — enforced by the domain's `HAS_JUSTIFICATION`
 * precondition (`domain/control-lifecycle.ts`), not a conditional
 * class-validator decorator here, matching the same discipline
 * `TransitionRiskRequestDto` uses for its own gated transitions.
 */
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ControlStatus } from '@prisma/client';

const CONTROL_STATUS_VALUES: readonly ControlStatus[] = ['DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED'];

export class TransitionControlRequestDto {
  @IsIn(CONTROL_STATUS_VALUES, { message: USER_MESSAGES.dto.controlTransition.toStatus.isIn })
  toStatus!: ControlStatus;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.controlTransition.justification.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.controlTransition.justification.maxLength })
  justification?: string;
}
