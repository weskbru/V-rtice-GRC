/**
 * T040/005-audit-findings, User Story 1 — matches
 * `contracts/audit.openapi.yaml`'s `CancelAuditEngagementRequest` (FR-004a):
 * `additionalProperties: false`. `justification` is DECLARED required by
 * the contract's JSON Schema (`required: [justification]`), but the
 * operation's own `422` response documents "justification is empty" as a
 * BUSINESS-rule refusal, not a `400` request-shape one — mirroring
 * `DeclareApplicabilityRequestDto`'s own precedent exactly (see that file's
 * header for the full reasoning this one does not repeat). This DTO
 * therefore does NOT declare `justification` as a hard class-validator-
 * required field (which would produce `400` on omission); it only
 * constrains its TYPE and maximum length here.
 * `assertCancellationJustificationProvided` (`audit-engagement.entity.ts`)
 * is what actually enforces non-emptiness with a `ValidationDomainError`
 * (422).
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CancelAuditEngagementRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.cancelAuditEngagement.justification.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.cancelAuditEngagement.justification.length })
  justification?: string;
}
