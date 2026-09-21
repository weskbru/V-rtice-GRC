/**
 * T197 — `DashboardController`: `GET /dashboard`
 * (`contracts/platform.openapi.yaml`'s `getDashboard` operation, ~414,
 * tag "Dashboard", FR-047 to FR-052).
 *
 * `@NoPermissionRequired()`, not `@RequirePermission`: the contract states
 * "Requires an authenticated session" with no permission gating the
 * ENDPOINT itself — `SessionGuard` (global) already refuses an
 * unauthenticated caller before this controller runs. The permission
 * question the contract DOES ask ("a caller without `risk:view` receives
 * zeroed risk areas") is answered inside `GetDashboardUseCase`, per-area,
 * not by a controller-level guard — see that use case's own header for why
 * a single `@RequirePermission` here would be the wrong shape entirely (it
 * would turn "zeroed for this caller" into "403 for this caller", which is
 * not what the contract specifies).
 *
 * Declared as its own top-level controller (`@Controller()`, matching
 * `RiskReferenceDataController`'s own pattern) rather than a method on
 * `RiskController`: `/dashboard` is not under `/risks`, and the GRC
 * dashboard is explicitly NOT a risk-only concept (CLAUDE.md §11: "O
 * Dashboard deve ser concebido como Dashboard GRC") even though every
 * populated area in this release happens to be backed by Risk Management.
 */
import { Controller, Get } from '@nestjs/common';

import { NoPermissionRequired } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { GetDashboardUseCase } from '../application/get-dashboard.usecase';

import { toDashboardResponse, type DashboardResponse } from './dto/dashboard-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

@Controller()
export class DashboardController {
  constructor(private readonly getDashboardUseCase: GetDashboardUseCase) {}

  @NoPermissionRequired()
  @Get('dashboard')
  async getDashboard(@CurrentSession() session: ValidatedSession): Promise<DashboardResponse> {
    const output = await this.getDashboardUseCase.execute({ actorUserId: session.userId });
    return toDashboardResponse(output);
  }
}
