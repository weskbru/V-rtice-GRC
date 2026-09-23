import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { FindingStatus } from '@prisma/client';

const FINDING_STATUS_VALUES: readonly FindingStatus[] = [
  'OPEN',
  'IN_REMEDIATION',
  'CLOSED',
  'ARCHIVED',
];

export class ListAuditEngagementFindingsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.findingListQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.findingListQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.findingListQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.findingListQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.findingListQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsIn(FINDING_STATUS_VALUES, { message: USER_MESSAGES.dto.findingListQuery.status.isIn })
  status?: FindingStatus;
}
