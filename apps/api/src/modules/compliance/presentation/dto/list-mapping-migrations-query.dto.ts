/**
 * T043/004-compliance-management — matches `GET
 * /frameworks/{frameworkId}/versions/{versionId}/mapping-migrations`'s
 * query parameters (`listMappingMigrations` operation).
 */
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

export class ListMappingMigrationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listMappingMigrationsQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listMappingMigrationsQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listMappingMigrationsQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listMappingMigrationsQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listMappingMigrationsQuery.pageSize.isInt })
  pageSize = 25;
}
