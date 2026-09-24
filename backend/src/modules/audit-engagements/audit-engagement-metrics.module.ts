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
