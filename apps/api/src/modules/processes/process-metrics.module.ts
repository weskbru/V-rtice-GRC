import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ProcessMetricsPort } from '../../shared/grc-ports/process-metrics.port';

import { PrismaProcessRepository } from './infrastructure/prisma-process.repository';
import { ProcessMetricsAdapter } from './infrastructure/process-metrics.adapter';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaProcessRepository,
    { provide: ProcessMetricsPort, useClass: ProcessMetricsAdapter },
  ],
  exports: [ProcessMetricsPort],
})
export class ProcessMetricsModule {}
