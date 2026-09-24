import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ControlMetricsPort } from '../../shared/grc-ports/control-metrics.port';

import { ControlMetricsAdapter } from './infrastructure/control-metrics.adapter';
import { ControlQueryService } from './infrastructure/control-query.service';

@Module({
  imports: [PrismaModule],
  providers: [
    ControlQueryService,
    { provide: ControlMetricsPort, useClass: ControlMetricsAdapter },
  ],
  exports: [ControlMetricsPort],
})
export class ControlMetricsModule {}
