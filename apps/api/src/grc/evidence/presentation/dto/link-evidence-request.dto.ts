/**
 * T034/002-shared-grc-foundation, US1 — matches
 * `contracts/grc-foundation.openapi.yaml`'s `LinkEvidenceRequest` exactly.
 * `subjectType` is validated against the closed `EvidenceSubjectType` enum
 * at the DTO boundary (shape validity) — existence and scope of the
 * concrete `subjectId` are the USE CASE's job
 * (`EvidenceSubjectResolverPort`), never conflated with this shape check
 * (a valid enum value with a nonexistent id must still be rejected, by a
 * later, deliberate check — see `LinkEvidenceUseCase`).
 */
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import { EVIDENCE_SUBJECT_TYPE_VALUES } from './evidence-enum-values';

import type { EvidenceSubjectType } from '@prisma/client';

export class LinkEvidenceRequestDto {
  @IsIn(EVIDENCE_SUBJECT_TYPE_VALUES, { message: USER_MESSAGES.dto.evidenceLink.subjectType.isIn })
  subjectType!: EvidenceSubjectType;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.evidenceLink.subjectId.isUuid })
  subjectId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: USER_MESSAGES.dto.evidenceLink.note.maxLength })
  note?: string;
}
