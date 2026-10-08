import { IsIn } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { OrgUnitStatus } from '@prisma/client';

const STATUS_VALUES: readonly OrgUnitStatus[] = ['ACTIVE', 'INACTIVE'];

export class SetOrgUnitStatusRequestDto {
  @IsIn(STATUS_VALUES, { message: USER_MESSAGES.dto.setOrgUnitStatus.status.isIn })
  status!: OrgUnitStatus;
}
