import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { RiskStatus } from '@prisma/client';

const GATED_TARGET_VALUES: readonly RiskStatus[] = ['ACCEPTED', 'CLOSED'];

export class RequestApprovalRequestDto {
  @IsIn(GATED_TARGET_VALUES, { message: USER_MESSAGES.dto.requestApproval.toStatus.isIn })
  toStatus!: Extract<RiskStatus, 'ACCEPTED' | 'CLOSED'>;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.requestApproval.justification.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.requestApproval.justification.maxLength })
  justification?: string;
}
