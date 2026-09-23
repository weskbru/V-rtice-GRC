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
