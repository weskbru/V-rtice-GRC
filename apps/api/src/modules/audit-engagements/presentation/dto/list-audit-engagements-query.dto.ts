import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type {
  AuditEngagementListSortDirection,
  AuditEngagementListSortField,
} from '../../domain/ports/audit-engagement-repository.port';
import type { AuditEngagementStatus } from '@prisma/client';

const AUDIT_ENGAGEMENT_STATUS_VALUES: readonly AuditEngagementStatus[] = [
  'PLANNING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const SORT_FIELD_VALUES: readonly AuditEngagementListSortField[] = [
  'code',
  'periodStart',
  'updatedAt',
];

const SORT_DIRECTION_VALUES: readonly AuditEngagementListSortDirection[] = ['asc', 'desc'];

export class ListAuditEngagementsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listAuditEngagementsQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listAuditEngagementsQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.listAuditEngagementsQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.listAuditEngagementsQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.listAuditEngagementsQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @IsIn(AUDIT_ENGAGEMENT_STATUS_VALUES, {
    message: USER_MESSAGES.dto.listAuditEngagementsQuery.status.isIn,
  })
  status?: AuditEngagementStatus;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.listAuditEngagementsQuery.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @IsUUID(undefined, {
    message: USER_MESSAGES.dto.listAuditEngagementsQuery.leadAuditorUserId.isUuid,
  })
  leadAuditorUserId?: string;

  @IsOptional()
  @IsIn(SORT_FIELD_VALUES, { message: USER_MESSAGES.dto.listAuditEngagementsQuery.sort.isIn })
  sort: AuditEngagementListSortField = 'code';

  @IsOptional()
  @IsIn(SORT_DIRECTION_VALUES, {
    message: USER_MESSAGES.dto.listAuditEngagementsQuery.direction.isIn,
  })
  direction: AuditEngagementListSortDirection = 'asc';
}
