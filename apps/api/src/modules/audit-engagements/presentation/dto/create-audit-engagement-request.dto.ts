/**
 * T040/005-audit-findings, User Story 1 — matches
 * `contracts/audit.openapi.yaml`'s `CreateAuditEngagementRequest` exactly:
 * `additionalProperties: false` (global `ValidationPipe`'s
 * `forbidNonWhitelisted`) means this class is also, by construction, where
 * "code/status/version and every started/completed/cancelled field are
 * server-owned and rejected as unknown properties" is enforced — not
 * declaring the property IS the rejection, the same discipline
 * `CreateControlRequestDto`'s own header documents.
 */
import { IsDateString, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateAuditEngagementRequestDto {
  @IsString({ message: USER_MESSAGES.dto.auditEngagement.objective.isString })
  @Length(1, 2000, { message: USER_MESSAGES.dto.auditEngagement.objective.length })
  objective!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.auditEngagement.periodStart.isDateString })
  periodStart!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.auditEngagement.periodEnd.isDateString })
  periodEnd!: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.auditEngagement.orgUnitId.isUuid })
  orgUnitId!: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.auditEngagement.leadAuditorUserId.isUuid })
  leadAuditorUserId!: string;
}
