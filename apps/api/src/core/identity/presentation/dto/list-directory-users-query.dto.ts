/**
 * T095b — matches `GET /users`'s query parameters (`contracts/admin.openapi.yaml`,
 * `Page`/`PageSize`/`q` parameters): `page` (default 1), `pageSize` (default
 * 25, capped at 100) and an optional case-insensitive `q` search term.
 *
 * `@Type(() => Number)` converts the raw query string explicitly rather
 * than relying on the global pipe's `enableImplicitConversion`, which
 * depends on TypeScript's emitted `design:type` reflection metadata for the
 * property — empirically unreliable once `@typescript-eslint/no-inferrable-types`
 * strips the property's explicit `: number` annotation (confirmed: without
 * `@Type`, `?pageSize=100` reached `class-validator` still as the string
 * `"100"` and every numeric validator failed). `@Type` sidesteps reflection
 * entirely by telling `class-transformer` the target type directly.
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ListDirectoryUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.directoryQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.directoryQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.directoryQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.directoryQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.directoryQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: USER_MESSAGES.dto.directoryQuery.q.maxLength })
  q?: string;

  /**
   * Present, this switches the listing from the browse rule to the
   * assignment rule for this unit (`ListDirectoryUsersUseCase`'s own doc
   * comment) — "who may be made responsible for a record belonging to unit
   * U" rather than "whom may this actor look up".
   */
  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.directoryQuery.assignableForOrgUnitId.isUuid })
  assignableForOrgUnitId?: string;
}
