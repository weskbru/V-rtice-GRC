import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ListRolesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listRolesQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listRolesQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listRolesQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listRolesQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listRolesQuery.pageSize.isInt })
  pageSize = 25;
}
