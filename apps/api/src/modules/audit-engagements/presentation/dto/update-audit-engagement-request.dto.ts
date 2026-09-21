/**
 * T040/005-audit-findings, User Story 1 — matches
 * `contracts/audit.openapi.yaml`'s `UpdateAuditEngagementRequest`: every
 * property optional (partial update), `additionalProperties: false`,
 * `minProperties: 1` enforced by the controller (see
 * `audit-engagement.controller.ts`, mirroring `UpdateControlRequestDto`'s
 * identical convention and the identical reason given there — a single
 * call site, no dedicated custom validator class).
 */
import { IsDateString, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateAuditEngagementRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.auditEngagement.objective.isString })
  @Length(1, 2000, { message: USER_MESSAGES.dto.auditEngagement.objective.length })
  objective?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.auditEngagement.periodStart.isDateString })
  periodStart?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.auditEngagement.periodEnd.isDateString })
  periodEnd?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.auditEngagement.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.auditEngagement.leadAuditorUserId.isUuid })
  leadAuditorUserId?: string;
}
