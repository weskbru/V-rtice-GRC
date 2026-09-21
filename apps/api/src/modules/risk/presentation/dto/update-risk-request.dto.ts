/**
 * T091 — matches `contracts/risks.openapi.yaml`'s `UpdateRiskRequest`:
 * every property optional (partial update; "omitted properties are left
 * unchanged"), `additionalProperties: false` (same FR-062 rejection
 * mechanism as `CreateRiskRequestDto` — see that file's header), and
 * `minProperties: 1` — enforced in `RiskController` itself (see that file)
 * rather than by a class-validator decorator, since "the request body
 * parsed to zero own properties" is a shape check the controller can make
 * with a one-line `Object.keys` before ever constructing the use case
 * input, with no dedicated custom validator class needed for a single call
 * site.
 *
 * `orgUnitId`/`ownerUserId` are NOT nullable here (unlike in
 * `CreateRiskRequestDto`, where they are simply required) — matching the
 * contract precisely: a risk always has an org unit and an owner; a caller
 * may reassign either but never clear either to null.
 */
import { IsDateString, IsOptional, IsString, IsUUID, Length, MinLength } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class UpdateRiskRequestDto {
  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.risk.title.isString })
  @Length(1, 300, { message: USER_MESSAGES.dto.risk.title.length })
  title?: string;

  @IsOptional()
  @IsString({ message: USER_MESSAGES.dto.risk.description.isString })
  @MinLength(1, { message: USER_MESSAGES.dto.risk.description.minLength })
  description?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.categoryId.isUuid })
  categoryId?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.typeId.isUuid })
  typeId?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.originId.isUuid })
  originId?: string | null;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.ownerUserId.isUuid })
  ownerUserId?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.risk.responsibleUserId.isUuid })
  responsibleUserId?: string | null;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.risk.identifiedOn.isDateString })
  identifiedOn?: string;

  @IsOptional()
  @IsDateString({}, { message: USER_MESSAGES.dto.risk.nextReviewOn.isDateString })
  nextReviewOn?: string | null;
}
