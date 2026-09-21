/**
 * T095a — `ReferenceDataController`: `GET /risk-categories`, `GET /risk-types`
 * and `GET /risk-origins` (`contracts/platform.openapi.yaml`, tag
 * "Reference Data"). These were missing entirely from the US2 backend — the
 * risk create/edit form cannot populate its category/type/origin selects
 * without them (see the US2 integration closure notes).
 *
 * `@NoPermissionRequired()`, not `@RequirePermission`: the contract is
 * explicit — "Requires an authenticated session; no additional permission"
 * (FR-053) — any authenticated user may read this organization-configurable
 * classification data. `SessionGuard` (global) already refuses an
 * unauthenticated caller before this controller runs; `PermissionGuard`
 * still requires the explicit opt-in below or it denies by default
 * (`permission.guard.ts`'s documented "fail closed, always" rule).
 *
 * Administration of these tables (create/edit/deactivate) is explicitly OUT
 * of scope here — US8/T180 owns that surface. This controller is read-only
 * by construction: it has no `@Post`/`@Patch`/`@Delete` handler and never
 * will until that user story defines one against its own contract.
 */
import { Controller, Get, Query } from '@nestjs/common';

import { NoPermissionRequired } from '../../../core/authorization/presentation/permission.guard';
import { ListRiskReferenceDataUseCase } from '../application/list-risk-reference-data.usecase';

import { ReferenceDataQueryDto } from './dto/reference-data-query.dto';

import type { ReferenceDataItemRecord } from '../domain/ports/risk-reference-data.port';

@Controller()
export class RiskReferenceDataController {
  constructor(private readonly listReferenceData: ListRiskReferenceDataUseCase) {}

  @NoPermissionRequired()
  @Get('risk-categories')
  listCategories(
    @Query() query: ReferenceDataQueryDto,
  ): Promise<readonly ReferenceDataItemRecord[]> {
    return this.listReferenceData.listCategories(query.includeInactive);
  }

  @NoPermissionRequired()
  @Get('risk-types')
  listTypes(@Query() query: ReferenceDataQueryDto): Promise<readonly ReferenceDataItemRecord[]> {
    return this.listReferenceData.listTypes(query.includeInactive);
  }

  @NoPermissionRequired()
  @Get('risk-origins')
  listOrigins(@Query() query: ReferenceDataQueryDto): Promise<readonly ReferenceDataItemRecord[]> {
    return this.listReferenceData.listOrigins(query.includeInactive);
  }
}
