/**
 * T073/002-shared-grc-foundation, US3 — matches
 * `contracts/grc-foundation.openapi.yaml`'s `ReopenFindingRequest`
 * exactly: `required: [reason]`. The `400`-shape check is here
 * (non-empty, `class-validator`'s own trimming-aware `@IsString`); the
 * domain also re-checks non-blank text in
 * `finding.entity.ts#assertReopenReasonProvided` (422) — this DTO cannot
 * reject a whitespace-only string on its own, so the domain layer remains
 * the real backstop.
 */
import { IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ReopenFindingRequestDto {
  @IsString({ message: USER_MESSAGES.dto.reopenFinding.reason.isString })
  @Length(1, 4000, { message: USER_MESSAGES.dto.reopenFinding.reason.length })
  reason!: string;
}
