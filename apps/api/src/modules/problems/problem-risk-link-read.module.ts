import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ProblemRiskLinkReadPort } from '../../shared/grc-ports/problem-risk-link-read.port';

import { PrismaProblemRiskLinkReadAdapter } from './infrastructure/problem-risk-link-read.adapter';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: ProblemRiskLinkReadPort, useClass: PrismaProblemRiskLinkReadAdapter }],
  exports: [ProblemRiskLinkReadPort],
})
export class ProblemRiskLinkReadModule {}
