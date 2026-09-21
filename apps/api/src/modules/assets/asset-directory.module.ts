/**
 * T013/006-assets-processes — the composition-root wiring ADR-020 part 3
 * calls for: binds `AssetDirectoryPort` to `PrismaAssetDirectoryAdapter`
 * and makes that binding reachable from `modules/risk`'s and
 * `modules/controls`'s own injectors (Fase 5's own scope), WITHOUT either
 * module importing `AssetsModule`. Follows
 * `modules/controls/control-directory.module.ts` exactly — see that file's
 * header for the full reasoning this one does not repeat: a tiny,
 * `@Global()` module exists to be the ONE thing that legitimately needs to
 * be global (the boundary port binding), separate from `AssetsModule`
 * itself, which will grow controllers and use-case providers of its own
 * (Fase 3, out of this task's scope) that have no business being globally
 * injectable.
 *
 * `AppModule` does not import this module directly — `AssetsModule` does
 * (below), the same indirection `ControlsModule` uses for
 * `ControlDirectoryModule`.
 */
import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AssetDirectoryPort } from '../../shared/grc-ports/asset-directory.port';

import { PrismaAssetDirectoryAdapter } from './infrastructure/asset-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: AssetDirectoryPort, useClass: PrismaAssetDirectoryAdapter }],
  exports: [AssetDirectoryPort],
})
export class AssetDirectoryModule {}
