/**
 * 009-indicators-reports, T021 — composition-root wiring for
 * `ComplianceSummaryPort`, mirroring `control-directory.module.ts`'s
 * shape: a tiny module binding its own self-contained adapter, never
 * `ComplianceModule` itself, so `modules/indicators` reaches exactly one
 * port without importing `ComplianceModule`'s own controllers/use cases.
 *
 * `ControlDirectoryPort`/`ControlEffectivenessPort` (both `@Global()`) are
 * NOT imported here for the identical reason `compliance.module.ts`'s own
 * header documents: they are registered globally by `ControlsModule`'s own
 * composition root, already live in the same application-wide injector.
 *
 * Deliberately NOT `@Global()` itself: `IndicatorsModule` imports this
 * module directly to reach `ComplianceSummaryPort`, rather than relying on
 * global provider visibility that only holds when something else has
 * already imported `ComplianceModule` into the same graph — a partial
 * Nest test context would otherwise fail to resolve the port (CLAUDE.md
 * §19.10). `ComplianceModule` still imports this module too, so both
 * graphs bind the same port the same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ComplianceSummaryPort } from '../../shared/grc-ports/compliance-summary.port';

import { OrganizationComplianceSummaryAdapter } from './infrastructure/organization-compliance-summary.adapter';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: ComplianceSummaryPort, useClass: OrganizationComplianceSummaryAdapter }],
  exports: [ComplianceSummaryPort],
})
export class ComplianceSummaryModule {}
