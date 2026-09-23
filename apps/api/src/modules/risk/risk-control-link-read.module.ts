import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RiskControlLinkReadPort } from '../../shared/grc-ports/risk-control-link-read.port';

import { PrismaRiskControlLinkReadAdapter } from './infrastructure/risk-control-link-read.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: RiskControlLinkReadPort, useClass: PrismaRiskControlLinkReadAdapter }],
  exports: [RiskControlLinkReadPort],
})
export class RiskControlLinkReadModule {}
