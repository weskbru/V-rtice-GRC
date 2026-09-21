/**
 * T142 — `LinkControlUseCase`/`UnlinkControlUseCase` (FR-076, FR-077,
 * FR-025c, FR-084, ADR-005, ADR-013, ADR-008).
 * `POST`/`DELETE /risks/{riskId}/controls[/{linkId}]`
 * (`contracts/risks.openapi.yaml`'s `linkControlToRisk`/
 * `unlinkControlFromRisk`).
 *
 * ## "Already linked" (409/conflict) vs "stale version" (409/version-conflict)
 *
 * `LinkControlUseCase` checks `findActiveLink` BEFORE attempting the write
 * and throws `ConflictDomainError` (→ `.../conflict`) when a link already
 * exists — the partial unique index
 * (`risk_control_links_risk_id_control_id_active_key`, added by the
 * migration) is the real, race-free backstop if two such requests land
 * concurrently, but the pre-check gives a clean, attributable error in the
 * overwhelmingly common non-racing case. `OptimisticLockDomainError` (→
 * `.../version-conflict`) is reserved for a stale `If-Match`, via
 * `RiskRepositoryPort.touchVersion`'s same conditional-update mechanism
 * every other risk-aggregate write in this module uses — exactly the two
 * distinct problem `type`s `contracts/risks.openapi.yaml`'s `linkControlToRisk`
 * 409 branch says the response distinguishes.
 *
 * ## ADR-020 part 5, both halves - `control:view` on the referenced side
 *
 * Closes the gap ADR-020 part 5 (`docs/architecture/decisions.md`) always
 * required and no code ever enforced: creating the link needs `risk:treat`
 * (checked by `RiskRelationshipController`'s `@RequirePermission`) AND
 * `control:view` on the referenced control, resolved here the same way
 * `GetDashboardUseCase`/`GetRiskLifecycleUseCase` vary behaviour by
 * permission - through `PermissionResolverService`, the platform's one
 * decision path (ADR-003). A caller without `control:view` is refused with
 * the EXACT SAME `ValidationDomainError`/message this file already throws
 * for a control that does not exist or is inactive - the permission check
 * is folded into that same condition, not a second branch, so "exists but
 * you may not see it" and "does not exist" are the same object, never two
 * paths that could drift apart. `UnlinkControlUseCase` below deliberately
 * does NOT repeat this check - see its own comment for why.
 *
 * ## ADR-020 part 4, closed - organizational scope checked BEFORE the
 * write (F-46, `docs/deferred-findings.md`)
 *
 * Until this fix, the referenced control was resolved through
 * `ControlRegistryPort.findById` - a lookup that never carried `orgUnitId`
 * at all - so an actor scoped to unit A could link a risk in unit A to a
 * control belonging to unit B: `GET /risks/{riskId}/controls` would then
 * hand that caller an out-of-scope control's id, code and name, exactly
 * the "a valid identifier is information" leak ADR-020 part 4 exists to
 * prevent. `shared/grc-ports/control-directory.port.ts`'s own header
 * documented the gap precisely - it carried `orgUnitId` for exactly this
 * check, and stated plainly that this file never consulted it.
 *
 * The fix mirrors `LinkRequirementToControlUseCase`
 * (`modules/compliance/application/links/link-requirement-control.usecase.ts`)
 * exactly: this file now resolves the control through `ControlDirectoryPort`
 * directly (not `ControlRegistryPort`, which never exposed scope - left
 * bound/unused at the time of this fix, reported per §19.10, and since
 * removed entirely by D-11/T009, 007-implementation-remediation: the port,
 * its Prisma adapter and the binding in `risk.module.ts` are gone, this
 * file's own dependency on `ControlDirectoryPort` was already the only
 * production caller of the referenced-control lookup) and reuses the SAME
 * scope predicate
 * every other cross-module link check in this codebase already shares -
 * `isOrgUnitWithinScope` (`grc/shared/domain/org-scope.ts`), not a new
 * local helper. A control with `orgUnitId === null` is treated as visible
 * only to a caller with `GLOBAL` scope, matching the Compliance module's
 * own null-handling and `isOrgUnitWithinScope`'s own non-null contract.
 * Folded into the SAME condition as "does not exist", "inactive" and
 * "lacks `control:view`" - one `ValidationDomainError`/message, four
 * indistinguishable causes, proven in
 * `test/integration/risk-control-link.spec.ts`.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { OrgScopeEnforcerService } from '../../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../../grc/shared/domain/org-scope';
import {
  ConflictDomainError,
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { ControlDirectoryPort } from '../../../../shared/grc-ports/control-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../../domain/ports/risk-reference-data.port';
import { RiskControlLinkRepositoryPort } from '../../domain/ports/risk-relationship-repository.port';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { assertBusinessContentEditable } from '../../domain/risk.entity';

import type { ControlLinkRecord } from '../../domain/ports/risk-relationship-repository.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';

const RISK_ENTITY_LABEL = 'Risco';
const LINK_ENTITY_LABEL = 'Vínculo com controle';

export interface LinkControlInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly expectedVersion: number;
  readonly controlId: string;
}

export interface LinkResult<TLink> {
  readonly link: TLink;
  readonly risk: RiskRecord;
}

@Injectable()
export class LinkControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly controlLinkRepository: RiskControlLinkRepositoryPort,
    private readonly controlDirectory: ControlDirectoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkControlInput): Promise<LinkResult<ControlLinkRecord>> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    // F-38: recorded server-side, via `assertExistingRecordAccessible`,
    // whenever the risk actually exists outside `scope`.
    const currentRisk = await this.riskRepository.findById(scope, input.riskId);
    if (!currentRisk) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          entityLabel: RISK_ENTITY_LABEL,
        },
        () => this.riskRepository.findOrgUnitIdUnscoped(input.riskId),
      );
    }
    assertBusinessContentEditable(currentRisk.status);

    // ADR-020 part 4 (F-46) - a control outside the actor's organizational
    // scope answers exactly as a nonexistent one. ADR-020 part 5 - a
    // control that does not exist/is inactive and a control the actor
    // lacks `control:view` for answer with the exact same refusal (see
    // this file's header): all four conditions are folded into ONE check,
    // not branches that could ever diverge in shape.
    const [control, canViewControl] = await Promise.all([
      this.controlDirectory.findById(input.controlId),
      this.permissionResolver.hasPermission(input.actorUserId, 'control:view'),
    ]);
    // A control with `orgUnitId === null` is visible only to a caller with
    // `GLOBAL` scope - `isOrgUnitWithinScope` itself takes a non-null unit
    // id, so the null case is guarded explicitly rather than calling it
    // with a value it was never designed to accept, matching
    // `LinkRequirementToControlUseCase`'s own null-handling exactly.
    const controlOutOfScope = Boolean(
      control &&
      (control.orgUnitId === null
        ? scope.kind !== 'GLOBAL'
        : !isOrgUnitWithinScope(scope, control.orgUnitId)),
    );
    if (!control || !control.isActive || controlOutOfScope || !canViewControl) {
      throw new ValidationDomainError(USER_MESSAGES.risk.treatment.controlNotFound, [
        { field: 'id', message: USER_MESSAGES.risk.treatment.controlNotFound },
      ]);
    }

    const existing = await this.controlLinkRepository.findActiveLink(input.riskId, input.controlId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.risk.treatment.controlAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.controlLinkRepository.create(
        input.riskId,
        input.controlId,
        input.actorUserId,
      );

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
      );
      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      await this.auditRecorder.record({
        action: 'risk.control_linked',
        entityType: AuditEntityType.RISK_CONTROL_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, controlId: input.controlId },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return { link, risk: result.record };
    });
  }
}

export interface UnlinkControlInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly linkId: string;
  readonly expectedVersion: number;
}

/**
 * ADR-020 part 5 deliberately NOT extended here. `UnlinkControlUseCase`
 * takes no `controlId` from the caller at all - it resolves `linkId`
 * against `controlLinkRepository.findById(riskId, linkId)`, an identifier
 * the caller can only already hold from `GET /risks/{riskId}/controls`
 * (gated by `risk:view`, not `control:view`), which itself returns the
 * linked control's id/code/name (`RiskRelationshipController.
 * listControlLinks` -> `toControlLinkResponse`). Refusing unlink for a
 * missing `control:view` would add no oracle this caller does not already
 * have from the list they got `linkId` from - part 5's own wording ("Criar
 * o vínculo exige...") scopes the dual-permission requirement to creation.
 *
 * ## F-46's organizational-scope check (ADR-020 part 4) is, for the same
 * reason, deliberately NOT extended here either
 *
 * `LinkControlUseCase` above now refuses to CREATE a link to a control
 * outside the actor's scope, because picking an arbitrary `controlId` and
 * seeing whether the write succeeds is itself an oracle - a caller who
 * does not already know a control exists could use link creation to find
 * out. Unlink has no equivalent oracle to close: the control this
 * `linkId` points at was already fully disclosed - id, code AND name -
 * by the very listing (`GET /risks/{riskId}/controls`, `risk:view` only)
 * this caller had to read to obtain `linkId` in the first place. Refusing
 * the unlink because the control now sits outside the actor's scope would
 * not un-teach the caller anything they do not already know from that
 * list, and would add a genuine operational trap instead: a link created
 * while in scope (or by a `GLOBAL`-scoped actor, or before this fix
 * shipped) could become permanently un-removable by any unit-scoped actor
 * the moment an org restructuring moves the control out of their scope,
 * even though they can still see the risk and the link perfectly well.
 * `assertBusinessContentEditable`/`risk:treat` (checked by
 * `RiskRelationshipController`) already gate this write on the RISK's own
 * scope and status, which is the resource this method actually mutates -
 * the same reasoning `LinkRequirementToControlUseCase`'s sibling,
 * `UnlinkRequirementFromControlUseCase`, applies for the identical shape.
 */
@Injectable()
export class UnlinkControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly controlLinkRepository: RiskControlLinkRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkControlInput): Promise<RiskRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    // F-38: recorded server-side, via `assertExistingRecordAccessible`,
    // whenever the risk actually exists outside `scope`.
    const currentRisk = await this.riskRepository.findById(scope, input.riskId);
    if (!currentRisk) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.RISK,
          entityId: input.riskId,
          entityLabel: RISK_ENTITY_LABEL,
        },
        () => this.riskRepository.findOrgUnitIdUnscoped(input.riskId),
      );
    }
    assertBusinessContentEditable(currentRisk.status);

    const link = await this.controlLinkRepository.findById(input.riskId, input.linkId);
    if (link?.unlinkedAt !== null) {
      throw new NotFoundDomainError(LINK_ENTITY_LABEL, input.linkId);
    }

    return this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      await this.controlLinkRepository.unlink(input.linkId, input.actorUserId, unlinkedAt);

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
      );
      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      await this.auditRecorder.record({
        action: 'risk.control_unlinked',
        entityType: AuditEntityType.RISK_CONTROL_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { riskId: input.riskId, controlId: link.control.id, unlinkedAt },
        organizationalUnitId: result.record.orgUnit.id,
      });

      return result.record;
    });
  }
}
