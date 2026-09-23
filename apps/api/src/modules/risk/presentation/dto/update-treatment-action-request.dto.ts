import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ActionStatus } from '@prisma/client';

const ACTION_STATUS_VALUES: readonly ActionStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export class UpdateRiskTreatmentActionRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.treatmentAction.title.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.treatmentAction.title.length })
  title?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.treatmentAction.description.isString })
  description?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.treatmentAction.responsibleUserId.isUuid })
  responsibleUserId?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.treatmentAction.dueOn.isDateString })
  dueOn?: string;

  @IsOptional()
  @IsIn(ACTION_STATUS_VALUES, { message: USER_MESSAGES.dto.treatmentAction.status.isIn })
  status?: ActionStatus;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.treatmentAction.reopenReason.isString })
  reopenReason?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.treatmentAction.treatmentDecisionId.isUuid })
  treatmentDecisionId?: string | null;
}
