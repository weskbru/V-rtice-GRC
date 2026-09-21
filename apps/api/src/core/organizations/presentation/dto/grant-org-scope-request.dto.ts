/**
 * T180 — matches `contracts/admin.openapi.yaml`'s `GrantOrgScopeRequest`
 * (`additionalProperties: false`). Shape consistency (`UNIT` requires
 * `orgUnitId`, `GLOBAL` forbids one) is a domain rule (FR-025a), enforced
 * by `ScopeGrantService`, not by a `class-validator` decorator here — see
 * that service's file header.
 */
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
