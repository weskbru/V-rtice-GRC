import { IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { IsRegisteredAttachableEntityType } from '../../../comments/presentation/dto/registered-entity-type.validator';

import type { AttachableEntityType } from '@prisma/client';

export class UploadAttachmentRequestDto {
  @IsRegisteredAttachableEntityType({ message: USER_MESSAGES.dto.entityType.isIn })
  entityType!: AttachableEntityType;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.entityId.isUuid })
  entityId!: string;
}
