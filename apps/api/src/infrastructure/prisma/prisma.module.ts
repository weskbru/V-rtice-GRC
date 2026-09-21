import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global so `PrismaService` (and, through it, `runInTransaction`) is
 * available to `core/**`'s and `modules/**`'s own `infrastructure` layers
 * without every feature module re-importing it (allowed by ADR-011: a
 * capability's/module's `infrastructure` layer may reach the top-level
 * `infrastructure` element).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
