/**
 * T191/US9 — `RiskParentRecordAccessor`: Risk Management's registration
 * against the attachable/commentable entity-type registry
 * (`core/comments/domain/entity-registry.ts`). This is the concrete,
 * exercised proof that the registry works: `RiskModule`'s own constructor
 * calls `registerAttachableEntityType('RISK', ...)`/
 * `registerCommentableEntityType('RISK', ...)` with an instance of this
 * class, exactly where `registerRiskAuditAllowlists()` already sits — no
 * edit to `core/comments/**`/`core/files/**` was needed to add it.
 *
 * ## The two checks this combines, and why both are needed
 *
 * `GET /risks/{riskId}` is protected by BOTH `@RequirePermission('risk:view')`
 * (`PermissionGuard`, at the controller boundary) AND `GetRiskUseCase`'s own
 * organizational-scope check (`ScopeResolverService` + the scoped
 * repository read) — neither alone is FR-098's full authorization rule.
 * Comments/attachments reach a risk WITHOUT going through
 * `RiskController.findById` at all (their own controllers carry
 * `@NoPermissionRequired()` — see `AttachmentController`'s header for why),
 * so this accessor is the one place that reconstructs BOTH halves for the
 * dynamic, entity-type-driven case: a caller with global scope but no
 * `risk:view` at all must still be refused (checked explicitly here, first)
 * — `GetRiskUseCase` alone would let them through, since it has no notion
 * of the permission check `PermissionGuard` normally performs upstream.
 */
import { Injectable } from '@nestjs/common';

import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { NotFoundDomainError } from '../../../../shared/errors/domain-error';
import { GetRiskUseCase } from '../get-risk.usecase';

import type {
  ParentRecordAccess,
  ParentRecordAccessor,
} from '../../../../core/comments/domain/entity-registry';

const RISK_ENTITY_LABEL = 'Risco';

@Injectable()
export class RiskParentRecordAccessor implements ParentRecordAccessor {
  constructor(
    private readonly getRiskUseCase: GetRiskUseCase,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess> {
    const canView = await this.permissionResolver.hasPermission(actorUserId, 'risk:view');
    if (!canView) {
      // Same non-disclosing refusal `GetRiskUseCase` itself would throw for
      // an out-of-scope risk (FR-030) — a caller must not be able to tell
      // "you lack risk:view entirely" apart from "this risk is outside
      // your scope" apart from "no such risk".
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, entityId);
    }

    // Reuses `GetRiskUseCase` verbatim (the SAME scope-checked read
    // `RiskController.findById` uses) rather than a second, parallel path
    // to "is this risk visible to this actor" (Constitution: derived
    // answers computed in exactly one place).
    const risk = await this.getRiskUseCase.execute({ actorUserId, riskId: entityId });

    return { organizationalUnitId: risk.orgUnit.id };
  }
}
