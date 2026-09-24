import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { EvidenceSource, EvidenceType } from '@prisma/client';

const EVIDENCE_TYPE_VALUES: readonly EvidenceType[] = [
  'DOCUMENT',
  'SCREENSHOT',
  'SYSTEM_LOG',
  'ATTESTATION',
  'INSPECTION',
  'OTHER',
];

const EVIDENCE_SOURCE_VALUES: readonly EvidenceSource[] = [
  'MANUAL_UPLOAD',
  'SYSTEM_EXPORT',
  'THIRD_PARTY',
  'INSPECTION',
];

export class CreateEvidenceRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.evidence.orgUnitId.isUuid })
  orgUnitId!: string;

  @IsString({ message: USER_MESSAGES.dto.evidence.title.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.evidence.title.length })
  title!: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.evidence.description.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.evidence.description.maxLength })
  description?: string;

  @IsIn(EVIDENCE_TYPE_VALUES, { message: USER_MESSAGES.dto.evidence.type.isIn })
  type!: EvidenceType;

  @IsIn(EVIDENCE_SOURCE_VALUES, { message: USER_MESSAGES.dto.evidence.source.isIn })
  source!: EvidenceSource;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.evidence.ownerUserId.isUuid })
  ownerUserId!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.evidence.collectedOn.isDateString })
  collectedOn!: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.evidence.validUntil.isDateString })
  validUntil?: string;

  @IsOptional()
  @IsUrl(undefined, { message: USER_MESSAGES.dto.evidence.externalUrl.isUrl })
  @MaxLength(2000, { message: USER_MESSAGES.dto.evidence.externalUrl.maxLength })
  externalUrl?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.evidence.observation.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.evidence.observation.maxLength })
  observation?: string;
}
