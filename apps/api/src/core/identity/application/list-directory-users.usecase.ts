/**
 * T095b — the application-layer read side of `GET /users`
 * (`contracts/admin.openapi.yaml`). No transaction and no audit entry (a
 * read is never audited, ADR-005), so this needs only `ScopeResolverService`
 * (`core/organizations`, imported into `IdentityModule`; cross-capability
 * core imports are unrestricted, `apps/api/eslint.config.mjs`) and
 * `UserDirectoryPort`.
 *
 * See `UserDirectoryPort.listDirectory`'s own doc comment for why this
 * listing is scope-filtered even though the contract's prose for `GET
 * /users` does not itself mention scope: the coordinator's inviolable rule
 * ("/org-units e qualquer listagem de usuários filtram por escopo") applies
 * FR-025's general principle to every user listing, not only `/org-units`.
 *
 * ## `assignableForOrgUnitId` — the ASSIGNMENT question (F-34's real fix)
 *
 * Absent, this behaves exactly as the paragraph above describes: the BROWSE
 * rule, unchanged. Present, it switches the question to "who may be made
 * responsible for a record belonging to unit U" and answers it via
 * `AssignmentLineService` (`core/organizations`, see that service's and
 * `domain/assignment-line.ts`'s own doc comments for the rule and the
 * defect it closes) instead of the caller's own browse scope — the two
 * questions are answered by the SAME resolver the risk write path
 * (`CreateRiskUseCase`/`UpdateRiskUseCase`) enforces, so the set this
 * listing offers and the set the server accepts cannot drift apart again.
 *
 * Refusal (unit outside the caller's scope, or no such unit at all) is
 * folded into the SAME `NotFoundDomainError`, mirroring
 * `ListRiskAuditEventsUseCase`'s own "missing permission, out of scope, or
 * not existing at all are all the same outcome" shape (ADR-009) — an
 * out-of-scope unit id must never be distinguishable from a nonexistent
 * one, or a scope-limited caller could probe the org tree for ids that
 * exist above their own reach.
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { PermissionResolverService } from '../../authorization/application/permission-resolver.service';
import { AssignmentLineService } from '../../organizations/application/assignment-line.service';
import { ScopeResolverService } from '../../organizations/application/scope-resolver.service';
import { UserDirectoryPort } from '../domain/ports/user-directory.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { DirectoryUserRecord } from '../domain/ports/user-directory.port';

/** See file header — never reported to `AssignmentLineService`'s own error
 * shape, only mirrored here so a caller asking about a unit outside scope
 * or about a unit that does not exist gets the byte-identical `404`. */
const ORG_UNIT_ENTITY_LABEL = 'Unidade organizacional';

export interface ListDirectoryUsersInput {
  readonly actorUserId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly q: string | undefined;
  /**
   * Present only for an ASSIGNMENT lookup (see file header). Replaces the
   * browse-scope filter with the assignment line of this unit.
   */
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

    // F-CV-2: for an ASSIGNMENT lookup, `items` above is the FULL,
    // unpaginated assignment-line set (see `UserDirectoryPort.listDirectory`
    // header) — filtered here to candidates who can actually SEE a risk in
    // `assignableForOrgUnitId` (`risk:view` + scope reaching that unit,
    // `AssignmentLineService.isQuestionInScope` against the CANDIDATE, never
    // the caller), THEN paginated in memory. This never widens anyone's
    // access — it only stops the picker from offering a name the write path
    // (`CreateRiskUseCase`/`UpdateRiskUseCase`) would refuse a moment later,
    // which is the exact defect: a user accepted as owner and then unable to
    // open their own risk. The browse listing (no `assignableForOrgUnitId`)
    // is untouched — still DB-paginated, exactly as before.
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

  /** Keeps only candidates who hold `risk:view` AND have a scope reaching
   * `orgUnitId` — resolved per-candidate, in parallel (each call is cached,
   * `PermissionResolverService`/`ScopeResolverService`'s own doc comments),
   * never assumed from the caller's own permissions/scope. */
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

  /** See file header: an out-of-scope unit and a nonexistent unit must
   * refuse identically, so both branches throw the SAME
   * `NotFoundDomainError` labeled with the SAME id the caller supplied. */
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
