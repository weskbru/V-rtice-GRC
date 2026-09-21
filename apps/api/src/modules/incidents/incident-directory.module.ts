/**
 * 008-incidents-problems, foundation — the composition-root wiring
 * ADR-020 part 3 calls for: binds `IncidentDirectoryPort` to
 * `PrismaIncidentDirectoryAdapter` and makes that binding reachable from
 * `modules/problems`'s own injector, WITHOUT either module importing the
 * other. Mirrors `ControlDirectoryModule` exactly — see that file's own
 * header for the full reasoning (why a tiny `@Global()` module rather than
 * folding this into `IncidentsModule` itself) this one deliberately does
 * not repeat.
 */
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
