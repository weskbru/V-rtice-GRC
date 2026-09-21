/**
 * T034/002-shared-grc-foundation, US1 — matches `GET /evidence`'s query
 * parameters (`contracts/grc-foundation.openapi.yaml`'s `listEvidence`
 * operation) exactly. `@Type(() => Number)`/explicit `@Transform` on the
 * page/pageSize pair follow `ListRisksQueryDto`'s own established pattern.
 */
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import { EVIDENCE_SUBJECT_TYPE_VALUES } from './evidence-enum-values';

import type { EvidenceStatus, EvidenceSubjectType, EvidenceType } from '@prisma/client';

const EVIDENCE_STATUS_VALUES: readonly EvidenceStatus[] = ['ACTIVE', 'ARCHIVED'];

const EVIDENCE_TYPE_VALUES: readonly EvidenceType[] = [
  'DOCUMENT',
  'SCREENSHOT',
  'SYSTEM_LOG',
  'ATTESTATION',
  'INSPECTION',
  'OTHER',
];

export class ListEvidenceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.evidenceListQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.evidenceListQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.evidenceListQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.evidenceListQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.evidenceListQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsIn(EVIDENCE_STATUS_VALUES, { message: USER_MESSAGES.dto.evidenceListQuery.status.isIn })
  status?: EvidenceStatus;

  @IsOptional()
  @IsIn(EVIDENCE_TYPE_VALUES, { message: USER_MESSAGES.dto.evidenceListQuery.type.isIn })
  type?: EvidenceType;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.evidenceListQuery.ownerUserId.isUuid })
  ownerUserId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.evidenceListQuery.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.evidenceListQuery.expiringBefore.isDateString })
  expiringBefore?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: USER_MESSAGES.dto.evidenceListQuery.search.maxLength })
  search?: string;

  /** Both-or-neither with `subjectId` — see `list-evidence.usecase.ts`'s
   * own header for why this pair exists (the "evidence panel on a domain
   * screen" read path, SC-001). */
  @IsOptional()
  @IsIn(EVIDENCE_SUBJECT_TYPE_VALUES, {
    message: USER_MESSAGES.dto.evidenceListQuery.subjectType.isIn,
  })
  subjectType?: EvidenceSubjectType;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.evidenceListQuery.subjectId.isUuid })
  subjectId?: string;
}
