import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IndicatorMonitoringPort } from '../../shared/grc-ports/indicator-monitoring.port';

import { IndicatorMonitoringAdapter } from './infrastructure/indicator-monitoring.adapter';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: IndicatorMonitoringPort, useClass: IndicatorMonitoringAdapter }],
  exports: [IndicatorMonitoringPort],
})
export class IndicatorMonitoringModule {}
