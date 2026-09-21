/**
 * T034/002-shared-grc-foundation, US1 — matches
 * `contracts/grc-foundation.openapi.yaml`'s `UpdateEvidenceRequest`
 * exactly: `minProperties: 1` is enforced at the controller
 * (`assertUpdateBodyNotEmpty`, mirroring `risk.controller.ts`'s own
 * function), not by a `class-validator` decorator here — matching
 * `UpdateRiskRequestDto`'s own documented reasoning (a key-count check
 * misses `class-transformer`'s own-property-with-`undefined`-value
 * behavior under this project's `target: ES2023`).
 *
 * `code`, `status`, `archivedAt` and the creation metadata are not
 * declared here at all — not editable, matching the OpenAPI document's own
 * description.
 */
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

export class UpdateEvidenceRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.evidence.title.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.evidence.title.length })
  title?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.evidence.description.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.evidence.description.maxLength })
  description?: string;

  @IsOptional()
  @IsIn(EVIDENCE_TYPE_VALUES, { message: USER_MESSAGES.dto.evidence.type.isIn })
  type?: EvidenceType;

  @IsOptional()
  @IsIn(EVIDENCE_SOURCE_VALUES, { message: USER_MESSAGES.dto.evidence.source.isIn })
  source?: EvidenceSource;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.evidence.ownerUserId.isUuid })
  ownerUserId?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.evidence.collectedOn.isDateString })
  collectedOn?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.evidence.validUntil.isDateString })
  validUntil?: string | null;

  @IsOptional()
  @IsUrl(undefined, { message: USER_MESSAGES.dto.evidence.externalUrl.isUrl })
  @MaxLength(2000, { message: USER_MESSAGES.dto.evidence.externalUrl.maxLength })
  externalUrl?: string | null;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.evidence.observation.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.evidence.observation.maxLength })
  observation?: string | null;
}
