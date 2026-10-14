import { IsIn, IsOptional, IsUUID } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { OrgScopeType } from '@prisma/client';

const SCOPE_TYPE_VALUES: readonly OrgScopeType[] = ['UNIT', 'GLOBAL'];

export class GrantOrgScopeRequestDto {
  @IsIn(SCOPE_TYPE_VALUES, { message: USER_MESSAGES.dto.grantOrgScope.scopeType.isIn })
  scopeType!: OrgScopeType;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.grantOrgScope.orgUnitId.isUuid })
  orgUnitId?: string | null;
}
