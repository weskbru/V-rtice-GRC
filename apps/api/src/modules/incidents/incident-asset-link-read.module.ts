import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IncidentAssetLinkReadPort } from '../../shared/grc-ports/incident-asset-link-read.port';

import { PrismaIncidentAssetLinkReadAdapter } from './infrastructure/incident-asset-link-read.adapter';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: IncidentAssetLinkReadPort, useClass: PrismaIncidentAssetLinkReadAdapter }],
  exports: [IncidentAssetLinkReadPort],
})
export class IncidentAssetLinkReadModule {}
