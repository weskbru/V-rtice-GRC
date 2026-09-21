/**
 * T053/002-shared-grc-foundation, US2 — matches
 * `contracts/grc-foundation.openapi.yaml`'s `UpdateActionRequest` exactly:
 * `minProperties: 1` is enforced at the controller
 * (`assertUpdateBodyNotEmpty`, mirroring `evidence.controller.ts`'s own
 * function). No `status` — lifecycle transitions have their own operation.
 */
import { IsDateString, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateActionRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.action.title.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.action.title.length })
  title?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.action.description.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.action.description.maxLength })
  description?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.action.responsibleUserId.isUuid })
  responsibleUserId?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.action.dueOn.isDateString })
  dueOn?: string;
}
