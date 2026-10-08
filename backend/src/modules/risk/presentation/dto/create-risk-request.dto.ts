import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MinLength,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class CreateRiskRequestDto {
  @IsString({ message: USER_MESSAGES.dto.risk.title.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.risk.title.length })
  title!: string;

  @IsString({ message: USER_MESSAGES.dto.risk.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.risk.description.minLength })
  description!: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.categoryId.isUuid })
  categoryId?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.typeId.isUuid })
  typeId?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.originId.isUuid })
  originId?: string | null;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.orgUnitId.isUuid })
  orgUnitId!: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.ownerUserId.isUuid })
  ownerUserId!: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.responsibleUserId.isUuid })
  responsibleUserId?: string | null;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.risk.identifiedOn.isDateString })
  identifiedOn?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.risk.nextReviewOn.isDateString })
  nextReviewOn?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: USER_MESSAGES.dto.risk.causes.isString })
  @MinLength(1, { each: true, message: USER_MESSAGES.dto.risk.causes.minLength })
  causes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: USER_MESSAGES.dto.risk.consequences.isString })
  @MinLength(1, { each: true, message: USER_MESSAGES.dto.risk.consequences.minLength })
  consequences?: string[];
}
