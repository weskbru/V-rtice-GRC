import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IncidentMetricsPort } from '../../shared/grc-ports/incident-metrics.port';

import { IncidentMetricsAdapter } from './infrastructure/incident-metrics.adapter';
import { PrismaIncidentRepository } from './infrastructure/prisma-incident.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaIncidentRepository,
    { provide: IncidentMetricsPort, useClass: IncidentMetricsAdapter },
  ],
  exports: [IncidentMetricsPort],
})
export class IncidentMetricsModule {}
