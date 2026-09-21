/**
 * T180 — `GET /admin/org-units`'s `status` query parameter
 * (`contracts/admin.openapi.yaml`). Unlike `OrgUnitsQueryDto`
 * (`GET /org-units`), this has NO default — omitting it returns every
 * status, matching the contract's silence on a default for this
 * administrative listing (only the non-administrative `GET /org-units`
 * documents `default: ACTIVE`).
 */
import { IsIn, IsOptional } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { OrgUnitStatus } from '@prisma/client';

const STATUS_VALUES: readonly OrgUnitStatus[] = ['ACTIVE', 'INACTIVE'];

export class AdminOrgUnitsQueryDto {
  @IsOptional()
  @IsIn(STATUS_VALUES, { message: USER_MESSAGES.dto.adminOrgUnitsQuery.status.isIn })
  status?: OrgUnitStatus;
}
