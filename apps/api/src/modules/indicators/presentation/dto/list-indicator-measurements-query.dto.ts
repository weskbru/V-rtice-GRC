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
