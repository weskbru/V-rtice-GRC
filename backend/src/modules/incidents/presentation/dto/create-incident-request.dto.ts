import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { IncidentSeverity } from '@prisma/client';

const INCIDENT_SEVERITY_VALUES: readonly IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export class CreateIncidentRequestDto {
  @IsString({ message: USER_MESSAGES.dto.incident.title.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.incident.title.length })
  title!: string;

  @IsString({ message: USER_MESSAGES.dto.incident.description.isString })
  @Length(1, 8000, { message: USER_MESSAGES.dto.incident.description.length })
  description!: string;

  @IsIn(INCIDENT_SEVERITY_VALUES, { message: USER_MESSAGES.dto.incident.severity.isIn })
  severity!: IncidentSeverity;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.incident.orgUnitId.isUuid })
  orgUnitId!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.incident.reportedOn.isDateString })
  reportedOn!: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.incident.ownerUserId.isUuid })
  ownerUserId?: string;
}
