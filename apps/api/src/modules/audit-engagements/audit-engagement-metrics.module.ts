/**
 * 009-indicators-reports, T022 — composition-root wiring for
 * `AuditEngagementMetricsPort`, mirroring `control-directory.module.ts`'s
 * shape: a tiny module binding its OWN `PrismaAuditEngagementRepository`
 * instance, never `AuditEngagementsModule` itself.
 *
 * Deliberately NOT `@Global()`: `IndicatorsModule` imports this module
 * directly to reach `AuditEngagementMetricsPort`, rather than relying on
 * global provider visibility that only holds when something else has
 * already imported `AuditEngagementsModule` into the same graph — a
 * partial Nest test context would otherwise fail to resolve the port
 * (CLAUDE.md §19.10). `AuditEngagementsModule` still imports this module
 * too, so both graphs bind the same port the same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditEngagementMetricsPort } from '../../shared/grc-ports/audit-engagement-metrics.port';

import { AuditEngagementMetricsAdapter } from './infrastructure/audit-engagement-metrics.adapter';
import { PrismaAuditEngagementRepository } from './infrastructure/prisma-audit-engagement.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaAuditEngagementRepository,
    { provide: AuditEngagementMetricsPort, useClass: AuditEngagementMetricsAdapter },
  ],
  exports: [AuditEngagementMetricsPort],
})
export class AuditEngagementMetricsModule {}
