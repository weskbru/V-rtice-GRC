/**
 * T013/005-audit-findings — the composition-root wiring ADR-020 part 3
 * calls for: binds `RiskDirectoryPort` to `PrismaRiskDirectoryAdapter` and
 * makes that binding reachable from `grc/finding`'s own injector, WITHOUT
 * either side importing the other (FR-017, SC-008). Mirrors
 * `modules/controls/control-directory.module.ts` exactly — see that file's
 * header for the full "why its own tiny `@Global()` module" reasoning this
 * one does not repeat.
 *
 * `RiskModule` imports this module directly (so `modules/risk`'s own
 * providers may also depend on the token without a second binding); the
 * application's composition root (`app.module.ts`) already imports
 * `RiskModule`, so this binding is live before `grc/finding`'s and
 * `modules/audit-engagements`'s own providers ever resolve
 * `RiskDirectoryPort`.
 */
import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RiskDirectoryPort } from '../../shared/grc-ports/risk-directory.port';

import { PrismaRiskDirectoryAdapter } from './infrastructure/risk-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: RiskDirectoryPort, useClass: PrismaRiskDirectoryAdapter }],
  exports: [RiskDirectoryPort],
})
export class RiskDirectoryModule {}
