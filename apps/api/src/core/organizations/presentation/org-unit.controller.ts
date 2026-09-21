/**
 * T096a — `OrgUnitController`: `GET /org-units` only
 * (`contracts/admin.openapi.yaml`'s "Directory" tag). This was missing
 * entirely from the US2 backend — the risk create/edit form cannot populate
 * its organizational unit select without it, and it is the concrete
 * enforcement point for FR-025b/FR-025c on that form (a caller may only
 * create or reassign a risk into a unit inside their own scope).
 *
 * `@NoPermissionRequired()`, not `@RequirePermission`: the contract is
 * explicit — "Requires an authenticated session; no administrative
 * permission" — this is deliberately NOT gated by `orgUnit:administer` or
 * similar; every authenticated user may see the units within their own
 * scope. `GET /admin/org-units` (US8/T180, unscoped, `orgUnit:administer`)
 * is the separate, administrative surface this endpoint is explicitly not.
 *
 * Full org-unit administration (create/update/reparent/deactivate) is out
 * of scope here — US8/T180 owns `/admin/org-units`. This controller is
 * read-only by construction.
 */
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
