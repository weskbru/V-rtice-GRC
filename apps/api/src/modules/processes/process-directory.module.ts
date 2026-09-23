import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ProcessDirectoryPort } from '../../shared/grc-ports/process-directory.port';

import { PrismaProcessDirectoryAdapter } from './infrastructure/process-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: ProcessDirectoryPort, useClass: PrismaProcessDirectoryAdapter }],
  exports: [ProcessDirectoryPort],
})
export class ProcessDirectoryModule {}
