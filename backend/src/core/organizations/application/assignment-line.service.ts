import { Injectable } from '@nestjs/common';

import { buildAssignmentLine } from '../domain/assignment-line';
import { OrgScopeRepositoryPort } from '../domain/ports/org-scope-repository.port';
import { OrgUnitAdminRepositoryPort } from '../domain/ports/org-unit-admin-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';

@Injectable()
export class AssignmentLineService {
  constructor(
    private readonly orgUnitRepository: OrgUnitAdminRepositoryPort,
    private readonly orgScopeRepository: OrgScopeRepositoryPort,
  ) {}

  async resolveUnitIds(orgUnitId: string): Promise<ReadonlySet<string> | undefined> {
    const pathInfo = await this.orgUnitRepository.findPathInfoById(orgUnitId);
    if (!pathInfo) {
      return undefined;
    }

    const descendants = await this.orgScopeRepository.expandToDescendants([orgUnitId]);
    return buildAssignmentLine(pathInfo.path, descendants);
  }

  isQuestionInScope(scope: ScopeFilter, orgUnitId: string): boolean {
    return scope.kind === 'GLOBAL' || scope.unitIds.has(orgUnitId);
  }
}
