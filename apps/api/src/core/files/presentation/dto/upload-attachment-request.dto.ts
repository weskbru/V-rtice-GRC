/**
 * T190 — the non-file multipart fields of `POST /attachments`
 * (`contracts/platform.openapi.yaml`'s `uploadAttachment` operation): `file`
 * itself arrives via `@UploadedFile()`, handled separately by
 * `AttachmentController` (Nest's multipart handling populates `req.body`
 * with these plain string fields the same way a JSON body would).
 */
import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { IsRegisteredAttachableEntityType } from '../../../comments/presentation/dto/registered-entity-type.validator';

import type { AttachableEntityType } from '@prisma/client';

export class UploadAttachmentRequestDto {
  // F-22 defect 1: validated against the LIVE entity-type registry, not a
  // hand-maintained literal — see
  // core/comments/presentation/dto/registered-entity-type.validator.ts.
  @IsRegisteredAttachableEntityType({ message: USER_MESSAGES.dto.entityType.isIn })
  entityType!: AttachableEntityType;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.entityId.isUuid })
  entityId!: string;
}
