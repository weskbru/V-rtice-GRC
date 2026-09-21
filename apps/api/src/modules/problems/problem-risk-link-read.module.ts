/**
 * The composition-root wiring ADR-020 part 3 calls for, for the REVERSE
 * direction of the Problem<->Risk relationship: binds
 * `ProblemRiskLinkReadPort` to `PrismaProblemRiskLinkReadAdapter` and
 * makes that binding reachable from `modules/risk`'s own injector, WITHOUT
 * either module importing the other. Mirrors
 * `modules/incidents/incident-risk-link-read.module.ts` exactly.
 *
 * Deliberately NOT `@Global()`: `RiskModule`'s own
 * `ListRiskProblemLinksUseCase` imports this module directly to reach
 * `ProblemRiskLinkReadPort`, rather than relying on global provider
 * visibility that only holds when something else has already imported
 * `ProblemsModule` into the same graph — a partial Nest test context would
 * otherwise fail to resolve the port (CLAUDE.md §19.10). `ProblemsModule`
 * still imports this module too, so both graphs bind the same port the
 * same way.
 */
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { ProblemRiskLinkReadPort } from '../../shared/grc-ports/problem-risk-link-read.port';

import { PrismaProblemRiskLinkReadAdapter } from './infrastructure/problem-risk-link-read.adapter';

@Module({
  imports: [PrismaModule],
  providers: [{ provide: ProblemRiskLinkReadPort, useClass: PrismaProblemRiskLinkReadAdapter }],
  exports: [ProblemRiskLinkReadPort],
})
export class ProblemRiskLinkReadModule {}
