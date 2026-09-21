/**
 * 008-incidents-problems — `modules/problems`'s own registration against
 * `ActionOriginResolverPort`'s registry for `ActionOriginType.PROBLEM`
 * (spec.md FR-016, research.md D-2). Mirrors
 * `IncidentActionOriginAccessor` exactly — see that file's header for the
 * live-scope reasoning this one deliberately does not repeat.
 *
 * `Action.originId` for `PROBLEM` is the `Problem`'s own id.
 * `resolveEditableOrigin` is checked against `problem:edit` — stricter
 * than `resolveViewableOrigin` (`problem:view`).
 *
 * This accessor is more than plumbing for `Problem`: `Problem`'s own
 * `CLOSED` transition (data-model.md invariant P2) requires a
 * `COMPLETED` `Action` with `originType: PROBLEM` to exist for it — until
 * this file existed and was registered, no such `Action` could ever be
 * created, and US2's own closure requirement was unreachable (spec.md
 * FR-016's own dated note).
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { ProblemLookupPort } from '../domain/ports/problem-lookup.port';

import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../grc/shared/domain/ports/action-origin-resolver.port';
import type { UnitScopeFilter } from '../../../shared/persistence/scope-filter';

@Injectable()
export class ProblemActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly problemLookup: ProblemLookupPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  /** Registered for `ActionOriginType.PROBLEM` — `createAction`'s own
   * gate (FR-031). */
  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'problem:edit');
  }

  /** Registered for `ActionOriginType.PROBLEM` — the read-side
   * counterpart used only to populate `Action.originLabel`. */
  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'problem:view');
  }

  /** Registered for `ActionOriginType.PROBLEM` — the assurance-fix
   * SCOPE-ONLY re-check (no permission gate). Re-derives the problem's
   * LIVE unit on every call via `ProblemLookupPort.findScoped`, never a
   * value stamped on the `Action` at creation time. */
  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveScopedLookup(actorUserId, originId);
  }

  /** Registered for `ActionOriginType.PROBLEM` — the bulk, SCOPE-ONLY
   * listing `ListActionUseCase` uses to filter a page of actions by their
   * origin problem's CURRENT unit, in one query. */
  async listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.problemLookup.listIdsInScope(scope);
  }

  private async resolve(
    actorUserId: string,
    originId: string,
    requiredPermission: 'problem:edit' | 'problem:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, originId);
    }
    return this.resolveScopedLookup(actorUserId, originId);
  }

  private async resolveScopedLookup(
    actorUserId: string,
    originId: string,
  ): Promise<ActionOriginAccess> {
    const scope = await this.scopeResolver.resolveScope(actorUserId);
    const problem = await this.problemLookup.findScoped(scope, originId);
    if (!problem) {
      throw new NotFoundDomainError(USER_MESSAGES.problems.entityLabel, originId);
    }

    return {
      organizationalUnitId: problem.orgUnitId,
      label: `${problem.code} — ${problem.title}`,
    };
  }
}
