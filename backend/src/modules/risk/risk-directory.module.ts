import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { RiskDirectoryPort } from '../../shared/grc-ports/risk-directory.port';

import { PrismaRiskDirectoryAdapter } from './infrastructure/risk-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: RiskDirectoryPort, useClass: PrismaRiskDirectoryAdapter }],
  exports: [RiskDirectoryPort],
})
export class RiskDirectoryModule {}
