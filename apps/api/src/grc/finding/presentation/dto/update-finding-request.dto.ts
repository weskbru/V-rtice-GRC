/**
 * T073/002-shared-grc-foundation, US3 — matches
 * `contracts/grc-foundation.openapi.yaml`'s `UpdateFindingRequest`
 * exactly: `minProperties: 1` is enforced at the controller
 * (`assertUpdateBodyNotEmpty`, mirroring `evidence.controller.ts`'s own
 * function). **`status` is deliberately not declared here at all** — not
 * declaring it IS the rejection, via the global `ValidationPipe`'s
 * `forbidNonWhitelisted` (the adversarial test C5 this task requires: a
 * `status` field in this body must be REJECTED as an unknown property,
 * never silently ignored).
 */
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { FindingCategory, FindingPriority, FindingSeverity } from '@prisma/client';

const FINDING_CATEGORY_VALUES: readonly FindingCategory[] = [
  'NONCONFORMITY',
  'CONTROL_DEFICIENCY',
  'OBSERVATION',
  'IMPROVEMENT_OPPORTUNITY',
];

const FINDING_SEVERITY_VALUES: readonly FindingSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const FINDING_PRIORITY_VALUES: readonly FindingPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export class UpdateFindingRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.findings.title.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.findings.title.length })
  title?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.findings.description.isString })
  @Length(1, 8000, { message: USER_MESSAGES.dto.findings.description.length })
  description?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.findings.recommendation.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.findings.recommendation.maxLength })
  recommendation?: string | null;

  @IsOptional()
  @IsIn(FINDING_CATEGORY_VALUES, { message: USER_MESSAGES.dto.findings.category.isIn })
  category?: FindingCategory;

  @IsOptional()
  @IsIn(FINDING_SEVERITY_VALUES, { message: USER_MESSAGES.dto.findings.severity.isIn })
  severity?: FindingSeverity;

  @IsOptional()
  @IsIn(FINDING_PRIORITY_VALUES, { message: USER_MESSAGES.dto.findings.priority.isIn })
  priority?: FindingPriority;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.findings.ownerUserId.isUuid })
  ownerUserId?: string;
}
