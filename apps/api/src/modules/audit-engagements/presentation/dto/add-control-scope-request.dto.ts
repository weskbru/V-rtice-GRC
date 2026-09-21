/**
 * T040/005-audit-findings, User Story 1 — matches
 * `contracts/audit.openapi.yaml`'s `AddControlScopeRequest` exactly:
 * `additionalProperties: false`.
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class AddControlScopeRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.addControlScope.controlId.isUuid })
  controlId!: string;
}
