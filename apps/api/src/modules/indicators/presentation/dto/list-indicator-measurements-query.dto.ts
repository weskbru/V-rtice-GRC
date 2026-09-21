/**
 * 009-indicators-reports, Fase 4 (T037) — matches
 * `GET /indicators/{metricKey}/measurements`'s query parameters
 * (`contracts/indicators.openapi.yaml`'s shared `Page`/`PageSize`
 * parameters: default 1/20, `pageSize` capped at 100). Reuses
 * `USER_MESSAGES.dto.listIndicatorsQuery`'s own page/pageSize messages
 * (`listIndicatorDefinitions`' own DTO, Fase 3) rather than duplicating an
 * identical pair of messages for this operation — the validation rule is
 * the same, only the resource differs.
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ListIndicatorMeasurementsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listIndicatorsQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listIndicatorsQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listIndicatorsQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listIndicatorsQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listIndicatorsQuery.pageSize.isInt })
  pageSize = 20;
}
