import { IsIn, IsOptional } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { OrgUnitStatus } from '@prisma/client';

const STATUS_VALUES: readonly OrgUnitStatus[] = ['ACTIVE', 'INACTIVE'];

export class AdminOrgUnitsQueryDto {
  @IsOptional()
  @IsIn(STATUS_VALUES, { message: USER_MESSAGES.dto.adminOrgUnitsQuery.status.isIn })
  status?: OrgUnitStatus;
}
