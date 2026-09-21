/**
 * 009-indicators-reports, Fase 3 (T031) — matches
 * `contracts/indicators.openapi.yaml`'s `CreateIndicatorDefinitionRequest`
 * exactly. `additionalProperties: false` (the global `ValidationPipe`'s
 * `forbidNonWhitelisted`) means this class is also where a caller cannot
 * smuggle `code`/`isActive`/`createdByUserId` past creation.
 *
 * `metricKey` is validated as a non-empty string ONLY — deliberately NOT
 * against the closed `IndicatorMetricKey` enum (contrast every other
 * closed-enum field in this codebase's create DTOs, e.g. `severity`
 * below). The contract answers an unknown `metricKey` at creation with
 * `422` (`CreateIndicatorDefinitionUseCase`), not `400` from this pipe —
 * see that use case's own header and `indicators.ts#indicatorFields`.
 */
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { IndicatorThresholdComparator } from '@prisma/client';

const THRESHOLD_COMPARATOR_VALUES: readonly IndicatorThresholdComparator[] = [
  'GTE',
  'GT',
  'LTE',
  'LT',
];

export class CreateIndicatorDefinitionRequestDto {
  @IsString({ message: USER_MESSAGES.dto.indicator.metricKey.isString })
  @Length(1, 100, { message: USER_MESSAGES.dto.indicator.metricKey.length })
  metricKey!: string;

  @IsString({ message: USER_MESSAGES.dto.indicator.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.indicator.name.length })
  name!: string;

  @IsString({ message: USER_MESSAGES.dto.indicator.description.isString })
  @Length(1, 8000, { message: USER_MESSAGES.dto.indicator.description.length })
  description!: string;

  @IsUUID(undefined, { message: USER_MESSAGES.dto.indicator.ownerUserId.isUuid })
  ownerUserId!: string;

  @IsOptional()
  @IsIn(THRESHOLD_COMPARATOR_VALUES, {
    message: USER_MESSAGES.dto.indicator.thresholdComparator.isIn,
  })
  thresholdComparator?: IndicatorThresholdComparator;

  @IsOptional()
  @IsNumber({}, { message: USER_MESSAGES.dto.indicator.thresholdValue.isNumber })
  thresholdValue?: number;
}
