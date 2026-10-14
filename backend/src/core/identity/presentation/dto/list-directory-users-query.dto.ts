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

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.directoryQuery.assignableForOrgUnitId.isUuid })
  assignableForOrgUnitId?: string;
}
