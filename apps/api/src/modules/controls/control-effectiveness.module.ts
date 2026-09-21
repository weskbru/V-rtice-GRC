/**
 * T015/004-compliance-management — the composition-root wiring for
 * `ControlEffectivenessPort` (research.md D-9), mirroring
 * `control-directory.module.ts` exactly — see that file's header for the
 * full "why its own tiny `@Global()` module, not folded into
 * `ControlsModule`" reasoning this one does not repeat.
 *
 * `modules/compliance` needs `ControlEffectivenessPort` injected without
 * ever importing `ControlsModule` (SC-007); marking the FULL
 * `ControlsModule` `@Global()` would make its own controllers/use-case
 * providers globally injectable too, which nothing needs and which is not
 * this port's job to cause.
 *
 * Not yet consumed by any production code (`modules/compliance`'s User
 * Story 3, out of this workstream's own scope, is the first real
 * consumer) — reported per §19.10 of CLAUDE.md ("ponto de extensão só
 * conta depois de executado"): this binding exists and compiles, but is
 * not yet exercised by a real call site. `ControlsModule` imports this
 * module below so the binding is live in every environment that boots the
 * real application, ready for that first consumer.
 */
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
