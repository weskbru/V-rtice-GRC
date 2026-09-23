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
