/**
 * The composition-root wiring ADR-020 part 3 calls for ("o *composition
 * root* faz a ligação"), for the REVERSE direction of the Risk<->Control
 * relationship: binds `RiskControlLinkReadPort` to
 * `PrismaRiskControlLinkReadAdapter` and makes that binding reachable from
 * `modules/controls`'s own injector, WITHOUT either module importing the
 * other (SC-007). The mirror image of `modules/controls/control-directory.module.ts`.
 *
 * ## Why this is its own tiny `@Global()` module, not folded into `RiskModule`
 *
 * `ControlRelationshipModule`'s own `ListControlRiskLinksUseCase`
 * (`modules/controls`) needs `RiskControlLinkReadPort` injected. Nest
 * resolves a provider only within the providing module's own injector,
 * unless that module is `@Global()` — plain re-exporting would require
 * `ControlRelationshipModule` to `import RiskModule`, which is exactly the
 * module-to-module dependency ADR-011/ADR-020 forbid (and SC-007's own
 * boundary test asserts does not exist). Marking the FULL `RiskModule`
 * `@Global()` would be the wrong fix: it has controllers and use-case
 * providers of its own that have no business being globally injectable.
 * This module exists to be the ONE thing that legitimately needs to be
 * global — the boundary port binding — and nothing else, exactly as
 * `ControlDirectoryModule` does for the opposite direction.
 *
 * `AppModule` (the composition root) imports `RiskModule`, which imports
 * this module directly; it also imports `ControlRelationshipModule` for
 * that module's own routes. `@Global()` registration happens once, the
 * first time Nest instantiates it, regardless of how many places import it
 * — so `ControlRelationshipModule` never needs to import it directly, the
 * same relationship `ControlsModule`/`RiskModule` already have for
 * `ControlDirectoryPort`.
 *
 * Unlike every other `*LinkReadModule` in this codebase, this one CANNOT
 * be made non-`@Global()` by having its consumer import it directly: doing
 * so in `control-relationship.module.ts` (`modules/controls`) trips
 * `controls-risk-module-boundary.spec.ts` (SC-007), a static filesystem
 * guard that forbids any file under `modules/controls` from importing
 * anything under `modules/risk`'s directory tree — this file included,
 * regardless of how thin it is. The same latent risk §19.10 warns about
 * therefore remains here: a future test that overrides `RiskModule` in a
 * partial graph would fail to resolve `RiskControlLinkReadPort` in
 * `ControlRelationshipModule`. Fixing that would mean relocating this
 * port module outside `modules/risk` (e.g. under `shared/grc-ports`
 * alongside the port interface) — a boundary decision left to the
 * coordinator, not made here.
 */
import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RiskControlLinkReadPort } from '../../shared/grc-ports/risk-control-link-read.port';

import { PrismaRiskControlLinkReadAdapter } from './infrastructure/risk-control-link-read.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: RiskControlLinkReadPort, useClass: PrismaRiskControlLinkReadAdapter }],
  exports: [RiskControlLinkReadPort],
})
export class RiskControlLinkReadModule {}
