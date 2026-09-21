/**
 * T095a — matches the `IncludeInactive` parameter shared by
 * `GET /risk-categories|risk-types|risk-origins` (`contracts/platform.openapi.yaml`):
 * `includeInactive` (boolean, default `false`). `@Transform` converts the
 * raw query string (`"true"`/`"false"`) explicitly, rather than relying on
 * the global pipe's `enableImplicitConversion` for booleans, which is
 * documented for numbers/dates but not guaranteed for booleans — the first
 * boolean query parameter in this codebase, so nothing else to follow here.
 */
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ReferenceDataQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: USER_MESSAGES.dto.referenceDataQuery.includeInactive.isBoolean })
  includeInactive = false;
}
