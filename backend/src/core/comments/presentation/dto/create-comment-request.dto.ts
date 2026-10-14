import { IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import { IsRegisteredCommentableEntityType } from './registered-entity-type.validator';

import type { CommentableEntityType } from '@prisma/client';

export class CreateCommentRequestDto {
  @IsRegisteredCommentableEntityType({ message: USER_MESSAGES.dto.entityType.isIn })
  entityType!: CommentableEntityType;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.entityId.isUuid })
  entityId!: string;

  @IsString({ message: USER_MESSAGES.dto.comment.body.isString })
  @Length(1, 10000, { message: USER_MESSAGES.dto.comment.body.length })
  body!: string;
}
