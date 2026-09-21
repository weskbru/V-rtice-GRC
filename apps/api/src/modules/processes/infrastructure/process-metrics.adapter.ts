/**
 * 009-indicators-reports, T025 — the sole implementation of
 * `ProcessMetricsPort` (`shared/grc-ports/process-metrics.port.ts`).
 * Delegates to `PrismaProcessRepository.list` — the SAME catalog query
 * `GET /processes` already runs — with `pageSize: 1` and
 * `isActive: false`, reading only the page's own `total`.
 */
import { Injectable } from '@nestjs/common';

import { ProcessMetricsPort } from '../../../shared/grc-ports/process-metrics.port';

import { PrismaProcessRepository } from './prisma-process.repository';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';

@Injectable()
export class ProcessMetricsAdapter implements ProcessMetricsPort {
  constructor(private readonly processRepository: PrismaProcessRepository) {}

  async getInactiveCount(scope: ScopeFilter): Promise<number> {
    const page = await this.processRepository.list(
      scope,
      { isActive: false },
      { field: 'code', direction: 'asc' },
      1,
      1,
    );
    return page.total;
  }
}
