import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

function toBoolean({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const raw = obj[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

export class ListReportDefinitionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listReportsQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listReportsQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listReportsQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listReportsQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listReportsQuery.pageSize.isInt })
  pageSize = 20;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}
