/**
 * T072/002-shared-grc-foundation, US3 — `grc/finding`'s own registration
 * against `ActionOriginResolverPort`'s registry
 * (`grc/shared/domain/ports/action-origin-resolver.port.ts`) for
 * `ActionOriginType.FINDING` (FR-023: "Um achado MUST poder referenciar
 * ... ações que o remediem"). Registered directly from `FindingModule`'s
 * own constructor — both `grc/action` and `grc/finding` live under
 * `grc/**`, so no cross-boundary adapter is needed (see that registry's
 * own header, "Who registers what").
 *
 * Mirrors `modules/risk/application/collaboration/risk-action-origin
 * -accessor.ts`'s shape: `resolveEditableOrigin` (checked against
 * `finding:edit`, `createAction`'s own gate, FR-031) is stricter than
 * `resolveViewableOrigin` (checked against `finding:view`, used only to
 * populate `Action.originLabel`).
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { FindingRepositoryPort } from '../../domain/ports/finding-repository.port';
import { GetFindingUseCase } from '../get-finding.usecase';

import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../shared/domain/ports/action-origin-resolver.port';

@Injectable()
export class FindingActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly getFindingUseCase: GetFindingUseCase,
    private readonly permissionResolver: PermissionResolverService,
    private readonly findingRepository: FindingRepositoryPort,
  ) {}

  /** Registered for `ActionOriginType.FINDING` — `createAction`'s own
   * gate (FR-031). */
  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveFinding(actorUserId, originId, 'finding:edit');
  }

  /** Registered for `ActionOriginType.FINDING` — the read-side
   * counterpart used only to populate `Action.originLabel`. */
  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveFinding(actorUserId, originId, 'finding:view');
  }

  /** Registered for `ActionOriginType.FINDING` — the assurance-fix
   * SCOPE-ONLY re-check (see
   * `action-origin-resolver.port.ts#resolveOriginScope` for why this
   * deliberately skips the `finding:view`/`finding:edit` gate the two
   * methods above apply). `Finding.orgUnitId` is not currently mutable
   * after creation, so this origin type carries no live staleness risk
   * today — implemented anyway because every `ActionOriginAccessor` must
   * answer it, and because a future `Finding` re-assignment capability
   * must not silently regress this guarantee for `FINDING`-origin
   * actions the way it already had for `RISK_TREATMENT`-origin ones. */
  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    const finding = await this.getFindingUseCase.execute({ actorUserId, findingId: originId });
    return {
      organizationalUnitId: finding.orgUnit.id,
      label: `${finding.code} — ${finding.title}`,
    };
  }

  /** Registered for `ActionOriginType.FINDING` — the bulk, SCOPE-ONLY
   * listing `ListActionUseCase` uses to filter a page of actions by their
   * origin finding's CURRENT unit (Fix 1), in the same one-query shape
   * `RiskActionOriginAccessor.listOriginIdsInScope` uses for
   * `RISK_TREATMENT`. `Finding.orgUnitId` is not currently mutable after
   * creation (see `resolveOriginScope`'s own doc comment above), so this
   * carries no live staleness risk today either — implemented anyway so
   * every registered origin type answers the SAME bulk contract. */
  async listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.findingRepository.listIdsInScope(scope);
  }

  private async resolveFinding(
    actorUserId: string,
    findingId: string,
    requiredPermission: 'finding:edit' | 'finding:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(USER_MESSAGES.findings.entityLabel, findingId);
    }

    const finding = await this.getFindingUseCase.execute({ actorUserId, findingId });

    return {
      organizationalUnitId: finding.orgUnit.id,
      label: `${finding.code} — ${finding.title}`,
    };
  }
}
