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
