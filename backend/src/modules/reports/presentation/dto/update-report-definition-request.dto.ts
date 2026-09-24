import { IndicatorMetricKey } from '@prisma/client';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

const INDICATOR_METRIC_KEY_VALUES: readonly IndicatorMetricKey[] =
  Object.values(IndicatorMetricKey);

export class UpdateReportDefinitionRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.report.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.report.name.length })
  name?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.report.description.isString })
  @Length(1, 8000, { message: USER_MESSAGES.dto.report.description.length })
  description?: string;

  @IsOptional()
  @IsArray({ message: USER_MESSAGES.dto.report.metricKeys.isArray })
  @ArrayNotEmpty({ message: USER_MESSAGES.dto.report.metricKeys.arrayNotEmpty })
  @ArrayUnique({ message: USER_MESSAGES.dto.report.metricKeys.arrayUnique })
  @IsIn(INDICATOR_METRIC_KEY_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.report.metricKeys.isIn,
  })
  metricKeys?: IndicatorMetricKey[];

  @IsOptional()
  @IsBoolean({ message: USER_MESSAGES.dto.report.isActive.isBoolean })
  isActive?: boolean;
}
