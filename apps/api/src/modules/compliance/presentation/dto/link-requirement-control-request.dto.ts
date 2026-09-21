/**
 * T043/004-compliance-management — matches
 * `contracts/compliance.openapi.yaml`'s `LinkRequirementControlRequest`
 * exactly: `additionalProperties: false`.
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkRequirementControlRequestDto {
  @IsUUID('all', { message: USER_MESSAGES.dto.linkRequirementControl.controlId.isUuid })
  controlId!: string;
}
