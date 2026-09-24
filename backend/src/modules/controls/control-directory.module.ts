import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ControlDirectoryPort } from '../../shared/grc-ports/control-directory.port';

import { PrismaControlDirectoryAdapter } from './infrastructure/control-directory.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: ControlDirectoryPort, useClass: PrismaControlDirectoryAdapter }],
  exports: [ControlDirectoryPort],
})
export class ControlDirectoryModule {}
