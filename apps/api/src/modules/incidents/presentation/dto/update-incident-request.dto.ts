/**
 * 008-incidents-problems, US1 — matches
 * `contracts/incidents.openapi.yaml`'s `UpdateIncidentRequest` exactly:
 * `minProperties: 1` is enforced at the controller
 * (`assertUpdateBodyNotEmpty`, mirroring `FindingController`'s own
 * function). **`status`/`code` are deliberately not declared here at
 * all** — not declaring them IS the rejection, via the global
 * `ValidationPipe`'s `forbidNonWhitelisted`: a caller must go through
 * `POST /incidents/{id}/transitions` for any status change.
 */
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { IncidentSeverity } from '@prisma/client';

const INCIDENT_SEVERITY_VALUES: readonly IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export class UpdateIncidentRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.incident.title.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.incident.title.length })
  title?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.incident.description.isString })
  @Length(1, 8000, { message: USER_MESSAGES.dto.incident.description.length })
  description?: string;

  @IsOptional()
  @IsIn(INCIDENT_SEVERITY_VALUES, { message: USER_MESSAGES.dto.incident.severity.isIn })
  severity?: IncidentSeverity;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.incident.ownerUserId.isUuid })
  ownerUserId?: string;
}
