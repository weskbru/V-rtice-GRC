import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { IncidentStatus } from '@prisma/client';

const INCIDENT_STATUS_VALUES: readonly IncidentStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

export class TransitionIncidentRequestDto {
  @IsIn(INCIDENT_STATUS_VALUES, { message: USER_MESSAGES.dto.incidentTransition.toStatus.isIn })
  toStatus!: IncidentStatus;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.incidentTransition.resolutionSummary.isString })
  @MaxLength(4000, { message: USER_MESSAGES.dto.incidentTransition.resolutionSummary.maxLength })
  resolutionSummary?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.incidentTransition.cancellationReason.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.incidentTransition.cancellationReason.maxLength })
  cancellationReason?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.incidentTransition.reopenReason.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.incidentTransition.reopenReason.maxLength })
  reopenReason?: string;
}
