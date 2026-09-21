/**
 * T033/003-controls-management, User Story 2 — the `page`/`pageSize`
 * query parameters for `GET /controls/{controlId}/assessments`
 * (`contracts/controls.openapi.yaml`'s `#/components/parameters/Page`/
 * `PageSize`). Mirrors `modules/risk/presentation/dto/page-query.dto.ts`'s
 * own shape — this module's own copy, reusing the shared, generic
 * `USER_MESSAGES.dto.pageQuery` message (not an import from
 * `modules/risk`).
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class AssessmentPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.pageQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.pageQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.pageQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.pageQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.pageQuery.pageSize.isInt })
  pageSize = 25;
}
