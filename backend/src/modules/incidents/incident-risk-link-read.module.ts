import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IncidentRiskLinkReadPort } from '../../shared/grc-ports/incident-risk-link-read.port';

import { PrismaIncidentRiskLinkReadAdapter } from './infrastructure/incident-risk-link-read.adapter';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: IncidentRiskLinkReadPort, useClass: PrismaIncidentRiskLinkReadAdapter }],
  exports: [IncidentRiskLinkReadPort],
})
export class IncidentRiskLinkReadModule {}
