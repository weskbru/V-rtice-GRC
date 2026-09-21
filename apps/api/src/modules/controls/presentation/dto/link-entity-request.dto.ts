/**
 * T040/003-controls-management, User Story 3 — matches
 * `contracts/controls.openapi.yaml`'s `LinkEntityRequest` exactly
 * (`additionalProperties: false`). Shared verbatim by the process and
 * asset link endpoints, mirroring
 * `modules/risk/presentation/dto/link-entity-request.dto.ts`'s own
 * identical shape — declared as this module's own copy rather than
 * imported from `modules/risk` (a business-module-to-business-module
 * import ADR-011/ADR-020 forbid), reusing only the shared, generic
 * `USER_MESSAGES.dto.link` message.
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class LinkEntityRequestDto {
  @IsUUID(undefined, { message: USER_MESSAGES.dto.link.id.isUuid })
  id!: string;
}
