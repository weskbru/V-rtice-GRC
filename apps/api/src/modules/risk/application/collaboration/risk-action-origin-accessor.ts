/**
 * T049/002-shared-grc-foundation, US2 — the risk module's registration
 * against `ActionOriginResolverPort`'s registry
 * (`grc/shared/domain/ports/action-origin-resolver.port.ts`) for
 * `ActionOriginType.RISK_TREATMENT`. Mirrors
 * `risk-evidence-subject-accessor.ts`/`risk-parent-record-accessor.ts`'s
 * shape — see those files' headers for the two-check rationale this file
 * does not repeat.
 *
 * `Action.originId` for `RISK_TREATMENT` is the `Risk`'s own id (NOT the
 * `RiskTreatmentAction`'s id) — the origin a treatment action arises FROM
 * is the risk being treated, and `risk:treat` (checked below) is exactly
 * the permission `POST /risks/{riskId}/treatment-actions` itself requires
 * (`treatment.controller.ts`).
 *
 * `resolveEditableOrigin` (checked against `risk:treat`, the EDIT-level
 * authority over risk treatment) is stricter than `resolveViewableOrigin`
 * (checked against `risk:view`) — see
 * `action-origin-resolver.port.ts#ActionOriginAccessor`'s own doc comments
 * for why both exist and when each is used.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { GetRiskUseCase } from '../get-risk.usecase';

import type {
  ActionOriginAccess,
  ActionOriginAccessor,
} from '../../../../grc/shared/domain/ports/action-origin-resolver.port';
import type { UnitScopeFilter } from '../../../../shared/persistence/scope-filter';

const RISK_ENTITY_LABEL = 'Risco';

@Injectable()
export class RiskActionOriginAccessor implements ActionOriginAccessor {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly permissionResolver: PermissionResolverService,
    private readonly riskRepository: RiskRepositoryPort,
  ) {}

  /** Registered for `ActionOriginType.RISK_TREATMENT` — `createAction`'s
   * own gate (FR-031). */
  async resolveEditableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveRisk(actorUserId, originId, 'risk:treat');
  }

  /** Registered for `ActionOriginType.RISK_TREATMENT` — the read-side
   * counterpart used only to populate `Action.originLabel`. */
  async resolveViewableOrigin(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    return this.resolveRisk(actorUserId, originId, 'risk:view');
  }

  /** Registered for `ActionOriginType.RISK_TREATMENT` — the assurance-fix
   * SCOPE-ONLY re-check `Get`/`Update`/`TransitionActionUseCase` call on
   * every request (see `action-origin-resolver.port.ts#resolveOriginScope`
   * for why this deliberately skips the `risk:view`/`risk:treat` gate
   * `resolveViewableOrigin`/`resolveEditableOrigin` above apply).
   * `GetRiskUseCase.execute` alone already performs exactly the check
   * needed here: it resolves `actorUserId`'s own organizational scope and
   * 404s when the risk's CURRENT `orgUnitId` falls outside it — with no
   * permission check of its own. */
  async resolveOriginScope(actorUserId: string, originId: string): Promise<ActionOriginAccess> {
    const risk = await this.getRiskUseCase.execute({ actorUserId, riskId: originId });
    return {
      organizationalUnitId: risk.orgUnit.id,
      label: USER_MESSAGES.risk.evidenceSubject.riskLabel(risk.code, risk.title),
    };
  }

  /** Registered for `ActionOriginType.RISK_TREATMENT` — the bulk,
   * SCOPE-ONLY listing `ListActionUseCase` uses to filter a page of
   * actions by their origin risk's CURRENT unit (Fix 1) without one
   * `resolveOriginScope` call per row. Delegates straight to
   * `RiskRepositoryPort.listIdsInScope` — the SAME `ScopedRepository`
   * predicate `GetRiskUseCase`/`resolveOriginScope` above rely on for a
   * single row, applied here to the whole `risk` table in one query. */
  async listOriginIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]> {
    return this.riskRepository.listIdsInScope(scope);
  }

  private async resolveRisk(
    actorUserId: string,
    riskId: string,
    requiredPermission: 'risk:treat' | 'risk:view',
  ): Promise<ActionOriginAccess> {
    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, riskId);
    }

    const risk = await this.getRiskUseCase.execute({ actorUserId, riskId });

    return {
      organizationalUnitId: risk.orgUnit.id,
      label: USER_MESSAGES.risk.evidenceSubject.riskLabel(risk.code, risk.title),
    };
  }
}
