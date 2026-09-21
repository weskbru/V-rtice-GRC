/**
 * T125/T126 — the `page`/`pageSize` query parameters shared verbatim by
 * `GET /risks/{riskId}/assessments` and `GET /risk-methodology/versions`
 * (`contracts/*.yaml`'s `#/components/parameters/Page`/`PageSize`).
 * Extracted once, here, because THIS dispatch introduces two consumers at
 * once — `ListRisksQueryDto` (US3) defines its own inline instead, since it
 * was the only consumer when it was written; not worth retrofitting.
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class PageQueryDto {
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
