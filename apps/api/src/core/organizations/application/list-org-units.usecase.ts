import { Injectable } from '@nestjs/common';

import { OrgUnitDirectoryPort } from '../domain/ports/org-unit-directory.port';

import { ScopeResolverService } from './scope-resolver.service';

import type {
  OrgUnitDirectoryStatus,
  OrgUnitNodeRecord,
} from '../domain/ports/org-unit-directory.port';

export interface ListOrgUnitsInput {
  readonly actorUserId: string;
  readonly status: OrgUnitDirectoryStatus;
}

@Injectable()
export class ListOrgUnitsUseCase {
  constructor(
    private readonly orgUnitDirectory: OrgUnitDirectoryPort,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  async execute(input: ListOrgUnitsInput): Promise<readonly OrgUnitNodeRecord[]> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    return this.orgUnitDirectory.listInScope(scope, input.status);
  }
}
