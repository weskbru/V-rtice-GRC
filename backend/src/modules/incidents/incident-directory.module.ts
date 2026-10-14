import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { IncidentDirectoryPort } from '../../shared/grc-ports/incident-directory.port';

import { PrismaIncidentDirectoryAdapter } from './infrastructure/incident-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: IncidentDirectoryPort, useClass: PrismaIncidentDirectoryAdapter }],
  exports: [IncidentDirectoryPort],
})
export class IncidentDirectoryModule {}
