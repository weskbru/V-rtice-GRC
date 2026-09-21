/**
 * T016/005-audit-findings — the composition-root wiring ADR-020 part 3
 * calls for: binds `FrameworkVersionDirectoryPort`/`RequirementDirectoryPort`
 * to their Prisma adapters and makes both bindings reachable from
 * `modules/audit-engagements`'s own injector, WITHOUT either module
 * importing the other (FR-017, SC-008). Mirrors
 * `modules/controls/control-directory.module.ts` exactly — see that file's
 * header for the full "why its own tiny `@Global()` module" reasoning this
 * one does not repeat.
 *
 * `ComplianceModule` imports this module directly; the application's
 * composition root (`app.module.ts`) already imports `ComplianceModule`, so
 * both bindings are live before `modules/audit-engagements`'s own providers
 * ever resolve either port.
 */
import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { FrameworkVersionDirectoryPort } from '../../shared/grc-ports/framework-version-directory.port';
import { RequirementDirectoryPort } from '../../shared/grc-ports/requirement-directory.port';

import { PrismaFrameworkVersionDirectoryAdapter } from './infrastructure/framework-version-directory.adapter';
import { PrismaRequirementDirectoryAdapter } from './infrastructure/requirement-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: FrameworkVersionDirectoryPort,
      useClass: PrismaFrameworkVersionDirectoryAdapter,
    },
    { provide: RequirementDirectoryPort, useClass: PrismaRequirementDirectoryAdapter },
  ],
  exports: [FrameworkVersionDirectoryPort, RequirementDirectoryPort],
})
export class ComplianceDirectoryModule {}
