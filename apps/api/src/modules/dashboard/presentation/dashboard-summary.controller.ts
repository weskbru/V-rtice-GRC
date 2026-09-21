/**
 * `DashboardSummaryController`: `GET /dashboard/summary`
 * (`contracts/platform.openapi.yaml`'s `getDashboardSummary` operation).
 *
 * `@NoPermissionRequired()`, not `@RequirePermission`, for the identical
 * reason `modules/risk/presentation/dashboard.controller.ts` gives for
 * `GET /dashboard`: the contract requires only an authenticated session at
 * the endpoint level (`SessionGuard`, global, already refuses an
 * unauthenticated caller before this controller runs) — the permission
 * question the contract DOES ask (which of the eleven metrics the caller
 * may see) is answered per-key, inside `GetDashboardSummaryUseCase`, never
 * by a controller-level guard that would turn "omitted for this caller"
 * into a `403` for the whole endpoint.
 *
 * Declared as its own top-level controller in its own business module
 * (`modules/dashboard`), never folded into `modules/risk`'s
 * `DashboardController`: this endpoint depends only on
 * `IndicatorCalculationPort` (`shared/grc-ports/**`) and must not import
 * anything from `modules/risk/**` — see the use case's own header for why
 * a new module was the only place this could legally live.
 */
import { Controller, Get } from '@nestjs/common';

import { NoPermissionRequired } from '../../../core/authorization/presentation/permission.guard';
import { CurrentSession } from '../../../core/identity/presentation/current-session.decorator';
import { GetDashboardSummaryUseCase } from '../application/get-dashboard-summary.usecase';

import {
  toDashboardSummaryResponse,
  type DashboardSummaryResponse,
} from './dto/dashboard-summary-response.mapper';

import type { ValidatedSession } from '../../../core/sessions/application/session.service';

@Controller()
export class DashboardSummaryController {
  constructor(private readonly getDashboardSummaryUseCase: GetDashboardSummaryUseCase) {}

  @NoPermissionRequired()
  @Get('dashboard/summary')
  async getSummary(@CurrentSession() session: ValidatedSession): Promise<DashboardSummaryResponse> {
    const output = await this.getDashboardSummaryUseCase.execute({
      actorUserId: session.userId,
    });
    return toDashboardSummaryResponse(output);
  }
}
