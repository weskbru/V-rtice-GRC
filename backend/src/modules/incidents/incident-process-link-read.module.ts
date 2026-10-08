import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IncidentProcessLinkReadPort } from '../../shared/grc-ports/incident-process-link-read.port';

import { PrismaIncidentProcessLinkReadAdapter } from './infrastructure/incident-process-link-read.adapter';

@Module({
  imports: [PrismaModule],
  providers: [
    { provide: IncidentProcessLinkReadPort, useClass: PrismaIncidentProcessLinkReadAdapter },
  ],
  exports: [IncidentProcessLinkReadPort],
})
export class IncidentProcessLinkReadModule {}
