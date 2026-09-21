/**
 * T143 — matches `contracts/risks.openapi.yaml`'s `LinkEntityRequest`
 * exactly (`additionalProperties: false`). Shared verbatim by the control,
 * process and asset link endpoints — the request shape is identical
 * ("identifier of the control, process or asset to associate"); which
 * registry `id` is validated against is determined entirely by which route
 * received the request, not by anything in the body.
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkEntityRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.link.id.isUuid })
  id!: string;
}
