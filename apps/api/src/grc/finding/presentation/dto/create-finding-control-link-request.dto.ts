/**
 * T072/005-audit-findings, US3 — `CreateFindingControlLinkRequest`
 * (`linkFindingToControl`, FR-013). `additionalProperties: false` in the
 * contract — enforced here by never declaring another property, the same
 * convention every other request DTO in this codebase follows.
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateFindingControlLinkRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.linkFindingControl.controlId.isUuid })
  controlId!: string;
}
