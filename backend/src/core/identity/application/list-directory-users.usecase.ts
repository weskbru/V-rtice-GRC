import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { PermissionResolverService } from '../../authorization/application/permission-resolver.service';
import { AssignmentLineService } from '../../organizations/application/assignment-line.service';
import { ScopeResolverService } from '../../organizations/application/scope-resolver.service';
import { UserDirectoryPort } from '../domain/ports/user-directory.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { DirectoryUserRecord } from '../domain/ports/user-directory.port';

const ORG_UNIT_ENTITY_LABEL = 'Unidade organizacional';

export interface ListDirectoryUsersInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly q: string | undefined;
  readonly assignableForOrgUnitId?: string | undefined;
}

export interface ListDirectoryUsersOutput {
  readonly items: readonly DirectoryUserRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

@Injectable()
export class ListDirectoryUsersUseCase {
  constructor(
    private readonly userDirectory: UserDirectoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly assignmentLine: AssignmentLineService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: ListDirectoryUsersInput): Promise<ListDirectoryUsersOutput> {
    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const assignment =
      input.assignableForOrgUnitId !== undefined
        ? await this.resolveAssignment(scope, input.assignableForOrgUnitId)
        : undefined;

    const { items, total } = await this.userDirectory.listDirectory({
      scope,
      page: input.page,
      pageSize: input.pageSize,
      q: input.q,
      ...(assignment !== undefined ? { assignment } : {}),
    });

    if (input.assignableForOrgUnitId !== undefined) {
      const visible = await this.filterVisibleToOrgUnit(items, input.assignableForOrgUnitId);
      const start = (input.page - 1) * input.pageSize;
      const page = visible.slice(start, start + input.pageSize);
      return {
        items: page,
        page: input.page,
        pageSize: input.pageSize,
        total: visible.length,
        totalPages: visible.length === 0 ? 0 : Math.ceil(visible.length / input.pageSize),
      };
    }

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / input.pageSize),
    };
  }

  private async filterVisibleToOrgUnit(
    candidates: readonly DirectoryUserRecord[],
    orgUnitId: string,
  ): Promise<readonly DirectoryUserRecord[]> {
    const checks = await Promise.all(
      candidates.map(async (candidate) => {
        const [canView, candidateScope] = await Promise.all([
          this.permissionResolver.hasPermission(candidate.id, 'risk:view'),
          this.scopeResolver.resolveScope(candidate.id),
        ]);
        return canView && this.assignmentLine.isQuestionInScope(candidateScope, orgUnitId);
      }),
    );
    return candidates.filter((_, index) => checks[index]);
  }

  private async resolveAssignment(
    scope: ScopeFilter,
    orgUnitId: string,
  ): Promise<{ readonly unitIds: readonly string[] }> {
    if (!this.assignmentLine.isQuestionInScope(scope, orgUnitId)) {
      throw new NotFoundDomainError(ORG_UNIT_ENTITY_LABEL, orgUnitId);
    }

    const unitIds = await this.assignmentLine.resolveUnitIds(orgUnitId);
    if (!unitIds) {
      throw new NotFoundDomainError(ORG_UNIT_ENTITY_LABEL, orgUnitId);
    }

    return { unitIds: [...unitIds] };
  }
}
