/**
 * `DashboardModule` — the dashboard capability's composition root
 * (F-22 defect 2 fix, SC-011). Sits directly under `src/core/dashboard/`,
 * exactly like `AuditModule`/`CommentsModule`/`FilesModule` — the one
 * place allowed to run bootstrap-time registration side effects for this
 * capability.
 *
 * Carries no providers or controllers of its own: `GET /dashboard` stays
 * on `modules/risk`'s own `DashboardController`
 * (`docs/local-environment.md` D-12's reasoning — the endpoint needs live
 * risk data only `modules/risk` can provide, and `core/**` may never
 * import `modules/**`). This module exists solely so
 * `registerDefaultPlannedAreas()` runs once, during Nest's `app.init()`,
 * before any request reaches `GetDashboardUseCase` — see
 * `domain/planned-area-registry.ts` for the registry itself and why it
 * lives in `core/`.
 */
import { Module } from '@nestjs/common';

import { registerDefaultPlannedAreas } from './domain/default-planned-areas';

@Module({})
export class DashboardModule {
  constructor() {
    registerDefaultPlannedAreas();
  }
}
