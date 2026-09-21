/**
 * 009-indicators-reports, T020 — composition-root wiring for
 * `ControlMetricsPort`, mirroring `control-directory.module.ts`/
 * `control-effectiveness.module.ts`'s shape: a tiny module binding its OWN
 * `ControlQueryService` instance (stateless, Prisma-backed only), never
 * `ControlsModule` itself, so `modules/indicators` reaches exactly one
 * port without importing `ControlsModule`'s controllers/use cases.
 *
 * Deliberately NOT `@Global()`: `IndicatorsModule` imports this module
 * directly, rather than relying on global provider visibility that only
 * holds when something else has already imported `ControlsModule` into
 * the same graph. A Nest contract-test context that overrides
 * `ControlsModule` wholesale (`test/contract/support/controls-contract-app.ts`)
 * drops that transitive import, and `@Global()` alone could not survive
 * it — the exact shape of CLAUDE.md §19.10 this task exists to fix.
 * `ControlsModule` still imports this module too, so both graphs bind the
 * same port the same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ControlMetricsPort } from '../../shared/grc-ports/control-metrics.port';

import { ControlMetricsAdapter } from './infrastructure/control-metrics.adapter';
import { ControlQueryService } from './infrastructure/control-query.service';

@Module({
  imports: [PrismaModule],
  providers: [
    ControlQueryService,
    { provide: ControlMetricsPort, useClass: ControlMetricsAdapter },
  ],
  exports: [ControlMetricsPort],
})
export class ControlMetricsModule {}
