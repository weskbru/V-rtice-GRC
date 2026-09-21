/**
 * T042/005-audit-findings, User Story 2 — matches
 * `contracts/audit.openapi.yaml`'s `CreateFindingFromEngagementRequest`
 * exactly: the SAME fields as `grc-foundation.openapi.yaml`'s own
 * `CreateFindingRequest`, minus `orgUnitId` — deliberately absent (never
 * accepted here; `additionalProperties: false` rejects it as unknown),
 * since it is derived server-side from the engagement's own `orgUnitId`
 * (FR-008). Reuses `USER_MESSAGES.dto.findings.*` — the exact same
 * field-level messages `CreateFindingRequestDto` already uses, since the
 * validation rules themselves are identical (research.md D-5: `origin` is
 * still chosen freely from the three existing `FindingOrigin` values, no
 * new one introduced).
 */
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  Length,
  MaxLength,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
} from '@prisma/client';

const FINDING_CATEGORY_VALUES: readonly FindingCategory[] = [
  'NONCONFORMITY',
  'CONTROL_DEFICIENCY',
  'OBSERVATION',
  'IMPROVEMENT_OPPORTUNITY',
];

const FINDING_ORIGIN_VALUES: readonly FindingOrigin[] = [
  'INTERNAL_ASSESSMENT',
  'CONTROL_TESTING',
  'MANAGEMENT_REVIEW',
];

const FINDING_SEVERITY_VALUES: readonly FindingSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const FINDING_PRIORITY_VALUES: readonly FindingPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export class CreateFindingFromEngagementRequestDto {
  @IsString({ message: USER_MESSAGES.dto.findings.title.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.findings.title.length })
  title!: string;

  @IsString({ message: USER_MESSAGES.dto.findings.description.isString })
  @Length(1, 8000, { message: USER_MESSAGES.dto.findings.description.length })
  description!: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.findings.recommendation.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.findings.recommendation.maxLength })
  recommendation?: string;

  @IsIn(FINDING_CATEGORY_VALUES, { message: USER_MESSAGES.dto.findings.category.isIn })
  category!: FindingCategory;

  @IsIn(FINDING_ORIGIN_VALUES, { message: USER_MESSAGES.dto.findings.origin.isIn })
  origin!: FindingOrigin;

  @IsIn(FINDING_SEVERITY_VALUES, { message: USER_MESSAGES.dto.findings.severity.isIn })
  severity!: FindingSeverity;

  @IsIn(FINDING_PRIORITY_VALUES, { message: USER_MESSAGES.dto.findings.priority.isIn })
  priority!: FindingPriority;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.findings.ownerUserId.isUuid })
  ownerUserId!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.findings.identifiedOn.isDateString })
  identifiedOn!: string;
}
