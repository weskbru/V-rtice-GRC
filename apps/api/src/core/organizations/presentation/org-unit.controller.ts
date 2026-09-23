import { Controller, Get, Query } from '@nestjs/common';

import { NoPermissionRequired } from '../../authorization/presentation/permission.guard';
import { CurrentSession } from '../../identity/presentation/current-session.decorator';
import { ListOrgUnitsUseCase } from '../application/list-org-units.usecase';

import { OrgUnitsQueryDto } from './org-units-query.dto';

import type { ValidatedSession } from '../../sessions/application/session.service';
import type { OrgUnitNodeRecord } from '../domain/ports/org-unit-directory.port';

@Controller('org-units')
export class OrgUnitController {
  constructor(private readonly listOrgUnits: ListOrgUnitsUseCase) {}

  @NoPermissionRequired()
  @Get()
  list(
    @CurrentSession() session: ValidatedSession,
    @Query() query: OrgUnitsQueryDto,
  ): Promise<readonly OrgUnitNodeRecord[]> {
    return this.listOrgUnits.execute({ actorUserId: session.userId, status: query.status });
  }
}
