import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { IndicatorThresholdComparator } from '@prisma/client';

const THRESHOLD_COMPARATOR_VALUES: readonly IndicatorThresholdComparator[] = [
  'GTE',
  'GT',
  'LTE',
  'LT',
];

export class UpdateIndicatorDefinitionRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.indicator.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.indicator.name.length })
  name?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.indicator.description.isString })
  @Length(1, 8000, { message: USER_MESSAGES.dto.indicator.description.length })
  description?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.indicator.ownerUserId.isUuid })
  ownerUserId?: string;

  @IsOptional()
  @IsIn(THRESHOLD_COMPARATOR_VALUES, {
    message: USER_MESSAGES.dto.indicator.thresholdComparator.isIn,
  })
  thresholdComparator?: IndicatorThresholdComparator | null;

  @IsOptional()
  @IsNumber({}, { message: USER_MESSAGES.dto.indicator.thresholdValue.isNumber })
  thresholdValue?: number | null;

  @IsOptional()
  @IsBoolean({ message: USER_MESSAGES.dto.indicator.isActive.isBoolean })
  isActive?: boolean;
}
