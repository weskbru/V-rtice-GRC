/**
 * T039/003-controls-management, Task C — `modules/controls`'s own
 * registration against `ActionOriginResolverPort`'s registry
 * (`grc/shared/domain/ports/action-origin-resolver.port.ts`) for
 * `ActionOriginType.CONTROL_ASSESSMENT` (FR-027, research.md D-5: "a
 * origem é o fato que justifica a ação — uma verificação que falhou — não
 * a entidade genérica"). Mirrors
 * `grc/finding/application/collaboration/finding-action-origin-accessor.ts`'s
 * shape exactly — see that file's header for the full two-check
 * rationale this file does not repeat.
 *
 * `Action.originId` for `CONTROL_ASSESSMENT` is the `ControlAssessment`'s
 * OWN id (never the `Control`'s) — the origin a remediation action arises
 * FROM is the failed verification itself, not the control it verified.
 *
 * `resolveEditableOrigin` is checked against `control:edit` (mirrors
 * `FindingActionOriginAccessor`'s own choice of the domain's edit-level
 * permission, since Controls has no dedicated "treat" permission the way
 * Risk does for `risk:treat`) — stricter than `resolveViewableOrigin`
 * (`control:view`).
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../../grc/shared/domain/org-scope';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { ControlAssessmentRepositoryPort } from '../../domain/ports/control-assessment-repository.port';

import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../../grc/shared/domain/ports/action-origin-resolver.port';
import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';

@Injectable()
export class ControlAssessmentActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly assessmentRepository: ControlAssessmentRepositoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly scopeResolver: ScopeResolverService,
  ) {}

  /** Registered for `ActionOriginType.CONTROL_ASSESSMENT` — `createAction`'s
   * own gate (FR-031). */
  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'control:edit');
  }

  /** Registered for `ActionOriginType.CONTROL_ASSESSMENT` — the read-side
   * counterpart used only to populate `Action.originLabel`. */
  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolve(actorUserId, originId, 'control:view');
  }

  /** Registered for `ActionOriginType.CONTROL_ASSESSMENT` — the
   * assurance-fix SCOPE-ONLY re-check (no permission gate — see
   * `action-origin-resolver.port.ts#resolveOriginScope`'s own doc comment
   * for why). */
  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveScopedLookup(actorUserId, originId);
  }

  /** Registered for `ActionOriginType.CONTROL_ASSESSMENT` — the bulk,
   * SCOPE-ONLY listing `ListActionUseCase` uses to filter a page of
   * actions by their origin assessment's parent control's CURRENT unit
   * (Fix 1 shape), in one query. */
  async listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.assessmentRepository.listAssessmentIdsInScope(scope);
  }

  private async resolve(
    actorUserId: string,
    originId: string,
    requiredPermission: 'control:edit' | 'control:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.assessmentEntityLabel, originId);
    }
    return this.resolveScopedLookup(actorUserId, originId);
  }

  private async resolveScopedLookup(
    actorUserId: string,
    originId: string,
  ): Promise<ActionOriginAccess> {
    const lookup = await this.assessmentRepository.findForOrigin(originId);
    if (!lookup) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.assessmentEntityLabel, originId);
    }

    const scope = await this.scopeResolver.resolveScope(actorUserId);
    if (!isOrgUnitWithinScope(scope, lookup.controlOrgUnitId)) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.assessmentEntityLabel, originId);
    }

    return {
      organizationalUnitId: lookup.controlOrgUnitId,
      label: `${lookup.controlCode} — verificação de ${lookup.assessedOn.toISOString().slice(0, 10)}`,
    };
  }
}
