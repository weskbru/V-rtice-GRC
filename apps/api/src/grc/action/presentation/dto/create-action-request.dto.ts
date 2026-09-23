import { ActionOriginType } from '@prisma/client';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

const ACTION_ORIGIN_TYPE_VALUES: readonly ActionOriginType[] = Object.values(ActionOriginType);

export class CreateActionRequestDto {
  @IsIn(ACTION_ORIGIN_TYPE_VALUES, { message: USER_MESSAGES.dto.action.originType.isIn })
  originType!: ActionOriginType;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.action.originId.isUuid })
  originId!: string;

  @IsString({ message: USER_MESSAGES.dto.action.title.isString })
  @Length(1, 200, { message: USER_MESSAGES.dto.action.title.length })
  title!: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.action.description.maxLength })
  @MaxLength(4000, { message: USER_MESSAGES.dto.action.description.maxLength })
  description?: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.action.responsibleUserId.isUuid })
  responsibleUserId!: string;

  @IsDateString({}, { message: USER_MESSAGES.dto.action.dueOn.isDateString })
  dueOn!: string;
}
