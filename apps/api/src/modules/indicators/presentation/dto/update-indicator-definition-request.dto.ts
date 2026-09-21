/**
 * 009-indicators-reports, Fase 8 (T068 prep) — matches
 * `contracts/indicators.openapi.yaml`'s `UpdateIndicatorDefinitionRequest`
 * exactly: every property optional (partial update), `additionalProperties:
 * false` (the global `ValidationPipe`'s `forbidNonWhitelisted`). Unlike
 * `UpdateFrameworkRequest`/`UpdateControlRequest`, the contract declares no
 * `minProperties` here — an empty `{}` body is legal (the use case treats
 * it as a no-op, `UpdateIndicatorDefinitionUseCase`'s own header).
 *
 * `metricKey` has NO field here at all — deliberately. The contract's
 * description states it plainly: "`metricKey` is immutable once created -
 * rejected as an unknown property if supplied". Because this class does
 * not declare it, `forbidNonWhitelisted` rejects any caller who tries,
 * with the SAME "unknown property" `400` every other PATCH in this
 * platform already gives its own immutable fields — no dedicated check is
 * needed anywhere else for this.
 *
 * `thresholdComparator`/`thresholdValue` are typed nullable
 * (`| null`, not just optional) — `@IsOptional()` treats an explicit
 * `null` the same as an absent property (skips further validation), which
 * is exactly the semantic this PATCH needs to let a caller CLEAR an
 * existing threshold: `undefined` (property absent) means "leave
 * untouched", `null` means "clear it", a value means "set it". See
 * `UpdateIndicatorDefinitionUseCase`'s own header for how the three states
 * are told apart and merged against the current row.
 */
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
