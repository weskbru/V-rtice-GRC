/**
 * 009-indicators-reports, Fase 7 (T054) — matches
 * `contracts/reports.openapi.yaml`'s `CreateReportDefinitionRequest`
 * exactly. `additionalProperties: false` (the global `ValidationPipe`'s
 * `forbidNonWhitelisted`) means this class is also where a caller cannot
 * smuggle `code`/`isActive`/`createdByUserId` past creation.
 *
 * `metricKeys` IS validated against the closed `IndicatorMetricKey` enum
 * HERE (`@IsIn(..., { each: true })`) — unlike
 * `CreateIndicatorDefinitionRequestDto.metricKey`, which deliberately is
 * not. The two contracts decide this differently on purpose:
 * `contracts/reports.openapi.yaml`'s own header states an unknown value
 * "is rejected as malformed (400), not as a domain error, because it fails
 * schema validation before any business rule runs" — the opposite of
 * `indicators.openapi.yaml`'s `createIndicatorDefinition`, which answers
 * the same fact with `422` from the use case. `CreateReportDefinitionUseCase`
 * (T051) still re-checks membership on its own input as defense-in-depth
 * (its own header) — reached only by a caller bypassing this DTO entirely.
 */
import { IndicatorMetricKey } from '@prisma/client';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsString, Length } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

const INDICATOR_METRIC_KEY_VALUES: readonly IndicatorMetricKey[] =
  Object.values(IndicatorMetricKey);

export class CreateReportDefinitionRequestDto {
  @IsString({ message: USER_MESSAGES.dto.report.name.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.report.name.length })
  name!: string;

  @IsString({ message: USER_MESSAGES.dto.report.description.isString })
  @Length(1, 8000, { message: USER_MESSAGES.dto.report.description.length })
  description!: string;

  @IsArray({ message: USER_MESSAGES.dto.report.metricKeys.isArray })
  @ArrayNotEmpty({ message: USER_MESSAGES.dto.report.metricKeys.arrayNotEmpty })
  @ArrayUnique({ message: USER_MESSAGES.dto.report.metricKeys.arrayUnique })
  @IsIn(INDICATOR_METRIC_KEY_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.report.metricKeys.isIn,
  })
  metricKeys!: IndicatorMetricKey[];
}
