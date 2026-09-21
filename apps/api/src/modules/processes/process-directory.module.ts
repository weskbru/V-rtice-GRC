/**
 * T013/006-assets-processes — the `Process` counterpart of
 * `modules/assets/asset-directory.module.ts`. Identical in shape and
 * reasoning (FR-020) — see that file's header for the full account this
 * one does not repeat.
 */
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
