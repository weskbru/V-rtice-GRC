/**
 * T010/003-controls-management — the composition-root wiring ADR-020 part
 * 3 calls for ("o *composition root* faz a ligação"): binds
 * `ControlDirectoryPort` to `PrismaControlDirectoryAdapter` and makes that
 * binding reachable from `modules/risk`'s own injector, WITHOUT either
 * module importing the other (SC-007).
 *
 * ## Why this is its own tiny `@Global()` module, not folded into
 * `ControlsModule`
 *
 * `RiskModule`'s own providers (`LinkControlUseCase`/`UnlinkControlUseCase`,
 * F-46 — `PrismaControlRegistryRepository`, T011, injected it too until
 * that dead class was removed by D-11/T009, 007-implementation-remediation)
 * need `ControlDirectoryPort` injected. Nest resolves a provider only
 * within the providing module's own injector, unless that module is
 * `@Global()` — plain re-exporting would require `RiskModule` to `import
 * ControlsModule`, which is exactly the module-to-module dependency
 * ADR-011/ADR-020 forbid (and SC-007's own boundary test asserts does not
 * exist). Marking the FULL `ControlsModule` `@Global()` would be the wrong
 * fix: it will grow controllers and use-case providers of its own (T020+,
 * out of this task's scope) that have no business being globally
 * injectable. This module exists to be the ONE thing that legitimately
 * needs to be global — the boundary port binding — and nothing else.
 *
 * `AppModule` (the composition root) imports this module directly; it also
 * imports `ControlsModule` for the module's own future routes. Both may
 * import it — `@Global()` registration happens once, the first time Nest
 * instantiates it, regardless of how many places import it.
 */
import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ControlDirectoryPort } from '../../shared/grc-ports/control-directory.port';

import { PrismaControlDirectoryAdapter } from './infrastructure/control-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: ControlDirectoryPort, useClass: PrismaControlDirectoryAdapter }],
  exports: [ControlDirectoryPort],
})
export class ControlDirectoryModule {}
