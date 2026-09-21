/**
 * T096a — matches `GET /org-units`'s `status` query parameter
 * (`contracts/admin.openapi.yaml`): `ACTIVE | INACTIVE`, defaulting to
 * `ACTIVE`.
 */
import { IsIn, IsOptional } from 'class-validator';

import { USER_MESSAGES } from '../../../shared/messages/user-messages';

import type { OrgUnitDirectoryStatus } from '../domain/ports/org-unit-directory.port';

const STATUS_VALUES: readonly OrgUnitDirectoryStatus[] = ['ACTIVE', 'INACTIVE'];

export class OrgUnitsQueryDto {
  @IsOptional()
  @IsIn(STATUS_VALUES, { message: USER_MESSAGES.dto.orgUnitsQuery.status.isIn })
  status: OrgUnitDirectoryStatus = 'ACTIVE';
}
