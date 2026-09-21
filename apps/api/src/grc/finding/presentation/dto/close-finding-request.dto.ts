/**
 * T073/002-shared-grc-foundation, US3 — matches
 * `contracts/grc-foundation.openapi.yaml`'s `CloseFindingRequest`.
 * `justification` is optional at the DTO/shape level (`400`) — its
 * REQUIREDNESS when no completed linked action exists is a business rule
 * (Invariant F1), enforced at `422` by
 * `finding.entity.ts#assertFindingCloseRequirementMet`, not here (the
 * `400`-shape/`422`-business-rule split every other invariant in this
 * feature follows).
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CloseFindingRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.closeFinding.justification.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.closeFinding.justification.maxLength })
  justification?: string;
}
