import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ControlEffectivenessPort } from '../../shared/grc-ports/control-effectiveness.port';

import { PrismaControlEffectivenessAdapter } from './infrastructure/control-effectiveness.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [{ provide: ControlEffectivenessPort, useClass: PrismaControlEffectivenessAdapter }],
  exports: [ControlEffectivenessPort],
})
export class ControlEffectivenessModule {}
