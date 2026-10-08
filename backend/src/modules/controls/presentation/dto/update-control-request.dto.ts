import { IsIn, IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { ControlFrequency, ControlNature, ControlType } from '@prisma/client';

const CONTROL_NATURE_VALUES: readonly ControlNature[] = ['MANUAL', 'AUTOMATED'];
const CONTROL_TYPE_VALUES: readonly ControlType[] = ['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE'];
const CONTROL_FREQUENCY_VALUES: readonly ControlFrequency[] = [
  'CONTINUOUS',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
];

export class UpdateControlRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.control.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.control.name.length })
  name?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.control.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.control.description.minLength })
  description?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.control.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.control.ownerUserId.isUuid })
  ownerUserId?: string | null;

  @IsOptional()
  @IsIn(CONTROL_NATURE_VALUES, { message: USER_MESSAGES.dto.control.nature.isIn })
  nature?: ControlNature | null;

  @IsOptional()
  @IsIn(CONTROL_TYPE_VALUES, { message: USER_MESSAGES.dto.control.type.isIn })
  type?: ControlType | null;

  @IsOptional()
  @IsIn(CONTROL_FREQUENCY_VALUES, { message: USER_MESSAGES.dto.control.frequency.isIn })
  frequency?: ControlFrequency | null;
}
