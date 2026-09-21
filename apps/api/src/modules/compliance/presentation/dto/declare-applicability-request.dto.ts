/**
 * T056/004-compliance-management — matches
 * `contracts/compliance.openapi.yaml`'s `DeclareApplicabilityRequest`
 * exactly: `additionalProperties: false`. `justification` is DECLARED
 * required by the contract's JSON Schema (`required: [justification]`),
 * but the operation's own description promises a `422` — not the generic
 * `400` every other missing/malformed required field in this API
 * produces — when it is omitted or empty (FR-015 AS1). `422` is the
 * DOMAIN-level "business rule" status (ADR-009); this file therefore does
 * NOT declare `justification` as a hard class-validator-required field
 * (which would produce `400`) — it only constrains its TYPE and maximum
 * length here, and `DeclareRequirementNotApplicableUseCase` is what
 * actually enforces non-emptiness with a `ValidationDomainError` (422),
 * mirroring `TransitionControlRequestDto`'s own established precedent for
 * a contractually-422 justification field.
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class DeclareApplicabilityRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.declareApplicability.justification.isString })
  @MaxLength(2000, { message: USER_MESSAGES.dto.declareApplicability.justification.length })
  justification?: string;
}
