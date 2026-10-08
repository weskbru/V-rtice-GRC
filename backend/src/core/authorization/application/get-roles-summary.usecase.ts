import { Injectable } from '@nestjs/common';

import { RoleRepositoryPort } from '../domain/ports/role-repository.port';

import type { RoleSummaryCounts } from '../domain/ports/role-repository.port';

export type RolesSummaryOutput = RoleSummaryCounts;

@Injectable()
export class GetRolesSummaryUseCase {
  constructor(private readonly roleRepository: RoleRepositoryPort) {}

  async execute(): Promise<RolesSummaryOutput> {
    return this.roleRepository.getSummaryCounts();
  }
}
