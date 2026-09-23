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
