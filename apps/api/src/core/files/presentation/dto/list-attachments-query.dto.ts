/**
 * T190 — `GET /attachments`'s query parameters
 * (`contracts/platform.openapi.yaml`'s `EntityTypeQuery`/`EntityIdQuery`/
 * `Page`/`PageSize` parameters).
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { IsRegisteredAttachableEntityType } from '../../../comments/presentation/dto/registered-entity-type.validator';

import type { AttachableEntityType } from '@prisma/client';

export class ListAttachmentsQueryDto {
  // F-22 defect 1: validated against the LIVE entity-type registry, not a
  // hand-maintained literal — see
  // core/comments/presentation/dto/registered-entity-type.validator.ts.
  @IsRegisteredAttachableEntityType({ message: USER_MESSAGES.dto.entityType.isIn })
  entityType!: AttachableEntityType;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.entityId.isUuid })
  entityId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.pageQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.pageQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.pageQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.pageQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.pageQuery.pageSize.isInt })
  pageSize = 25;
}
