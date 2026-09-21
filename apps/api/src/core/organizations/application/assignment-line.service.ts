/**
 * Resolves the organizational assignment line of a unit — the single
 * authoritative answer to "who may be made responsible for a record
 * belonging to unit U" (see `domain/assignment-line.ts` for the rule and
 * for the defect that made it necessary).
 *
 * There is exactly ONE resolver, deliberately, because the defect this
 * closes was three places holding three different answers: the directory
 * listing filtered by the caller's browse scope, the risk form inherited
 * that filter, and the risk write path enforced nothing beyond "the user is
 * active". Both the read side (`ListDirectoryUsersUseCase`) and the write
 * side (`CreateRiskUseCase`/`UpdateRiskUseCase`) now call this service, so
 * the set the interface offers and the set the server accepts cannot drift
 * apart again — they are the same computation.
 *
 * Lives in `core/organizations` because the rule is organizational: it is
 * expressed entirely over the unit tree and its materialized paths, and it
 * carries no risk-, control- or incident-specific semantics. Business
 * modules consume it (`modules/** -> core/**` is permitted, ADR-011).
 */
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

  /**
   * The assignment line of `orgUnitId`, or `undefined` when no such unit
   * exists.
   *
   * `undefined` rather than an empty set on purpose: an empty set is a
   * legitimate answer ("this unit's line contains no one"), while a missing
   * unit is a different condition the caller must be able to refuse
   * distinctly. Collapsing the two is how a bad id would silently become
   * "assign nobody" instead of an error.
   */
  async resolveUnitIds(orgUnitId: string): Promise<ReadonlySet<string> | undefined> {
    const pathInfo = await this.orgUnitRepository.findPathInfoById(orgUnitId);
    if (!pathInfo) {
      return undefined;
    }

    // Ancestors come free from the materialized path; only descendants need
    // the prefix query — the same expansion organizational scope itself uses,
    // so "descendant" means exactly one thing across this platform.
    const descendants = await this.orgScopeRepository.expandToDescendants([orgUnitId]);
    return buildAssignmentLine(pathInfo.path, descendants);
  }

  /**
   * Whether `scope` permits the caller to ask the assignment question about
   * `orgUnitId` at all.
   *
   * This is the guard that keeps the assignment lookup from becoming a
   * general-purpose people search: the line of a unit includes that unit's
   * ancestors, so being able to name any unit would let a caller walk
   * upward out of their own scope. A caller may only ask about a unit they
   * are already authorized to act within — which is precisely the unit a
   * record they are creating would belong to.
   */
  isQuestionInScope(scope: ScopeFilter, orgUnitId: string): boolean {
    return scope.kind === 'GLOBAL' || scope.unitIds.has(orgUnitId);
  }
}
