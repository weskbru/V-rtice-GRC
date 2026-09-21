/**
 * 009-indicators-reports, Fase 8 (T068 prep) — matches
 * `contracts/reports.openapi.yaml`'s `UpdateReportDefinitionRequest`
 * exactly: every property optional (partial update), `additionalProperties:
 * false` (the global `ValidationPipe`'s `forbidNonWhitelisted`). The
 * contract declares no `minProperties` here either — an empty `{}` body is
 * legal (the use case treats it as a no-op, mirroring
 * `UpdateIndicatorDefinitionUseCase`'s identical convention).
 *
 * `metricKeys` IS validated against the closed `IndicatorMetricKey` enum
 * HERE (`@IsIn(..., { each: true })`), the same choice
 * `CreateReportDefinitionRequestDto` already makes for its own field — see
 * that file's header for why this differs from
 * `UpdateIndicatorDefinitionRequestDto`'s deliberately loose `metricKey`
 * (there is no such field on THIS class: `metricKey` singular belongs to
 * `IndicatorDefinition`, not `ReportDefinition`, which carries the plural
 * `metricKeys` instead). `UpdateReportDefinitionUseCase` still re-checks
 * non-emptiness/membership on its own input as defense-in-depth (its own
 * header) — reached only by a caller bypassing this DTO entirely.
 */
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
