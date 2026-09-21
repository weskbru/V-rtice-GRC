/**
 * `/api/v1/health/live` and `/api/v1/health/ready` (T023 / ADR-012).
 *
 * Both are unauthenticated by construction — no auth guard exists yet in
 * this phase (Identity/Authentication is a later increment). Once the
 * global auth guard from ADR-003 lands, these two routes are exactly the
 * ones that must be annotated to opt back OUT of it (a health/orchestration
 * probe has no session to present).
 *
 * Per ADR-012, neither endpoint discloses anything beyond a per-dependency
 * boolean-ish status to an unauthenticated caller: no version string, no
 * connection string fragment, no driver error message, no stack trace.
 * `/ready` checks PostgreSQL always, and Redis only when the active
 * `CacheProvider` adapter actually is Redis (D-2) — the in-memory adapter
 * has nothing external to probe.
 *
 * The PostgreSQL check is deliberately more than plain connectivity: a
 * reachable-but-unmigrated database (a fresh container the operator has not
 * yet run `prisma migrate deploy` against) must not report ready, or an
 * orchestrator would route live traffic to an instance where every request
 * fails with a clean 500. Rather than `SELECT 1`, this queries Prisma's own
 * migration bookkeeping table (`_prisma_migrations`, written by `migrate
 * deploy`/`migrate dev`) for at least one completed row. That is a single
 * indexed, `LIMIT 1` read — no heavier than the connectivity check it
 * replaces — and it fails the same way (relation does not exist) on a
 * database that was never migrated, which this endpoint is polled often
 * enough that it must stay cheap either way. `/live` intentionally does NOT
 * perform this check: liveness means only "the process is up", and must
 * never fail just because migrations have not run yet, or an orchestrator
 * would kill a container that is merely waiting on an operator step.
 */
import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';

import { Public } from '../../shared/access/public.decorator';
import { CACHE_PROVIDER, type CacheProvider } from '../cache/cache-provider';
import { PrismaService } from '../prisma/prisma.service';

import type { Response } from 'express';

export type DependencyStatus = 'ok' | 'error';

export interface LivenessResponse {
  readonly status: 'ok';
}

export interface ReadinessResponse {
  readonly status: DependencyStatus;
  readonly checks: {
    readonly database: { readonly status: DependencyStatus };
    readonly cache?: { readonly status: DependencyStatus };
  };
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_PROVIDER) private readonly cache: CacheProvider,
  ) {}

  @Get('live')
  live(): LivenessResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponse> {
    const databaseHealthy = await this.checkDatabase();
    const cacheChecked = this.cache.kind === 'redis';
    const cacheHealthy = cacheChecked ? await this.cache.isHealthy() : true;
    const overallHealthy = databaseHealthy && cacheHealthy;

    res.status(overallHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: overallHealthy ? 'ok' : 'error',
      checks: {
        database: { status: databaseHealthy ? 'ok' : 'error' },
        ...(cacheChecked ? { cache: { status: cacheHealthy ? 'ok' : 'error' } } : {}),
      },
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      // Presence of at least one completed migration record is this
      // endpoint's proxy for "the schema the application requires is
      // present" (see the class-level comment above). A database that is
      // merely reachable but never migrated throws here (relation
      // "_prisma_migrations" does not exist) and is correctly reported
      // not-ready rather than ready.
      const rows = await this.prisma.$queryRaw<{ ready: number }[]>`
        SELECT 1 AS ready
        FROM "_prisma_migrations"
        WHERE "finished_at" IS NOT NULL
        LIMIT 1
      `;
      return rows.length > 0;
    } catch {
      return false;
    }
  }
}
