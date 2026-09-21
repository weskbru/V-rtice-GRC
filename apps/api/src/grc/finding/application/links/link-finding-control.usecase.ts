/**
 * T062-T064/005-audit-findings, US3 — `LinkFindingControlUseCase`/
 * `UnlinkFindingControlUseCase`/`ListFindingControlLinksUseCase`
 * (`linkFindingToControl`/`unlinkFindingFromControl`/
 * `listFindingControlLinks`, FR-013-FR-016, research.md D-4, D-11).
 *
 * ## ADR-020, all five parts, applied from this pair's first link
 *
 * 1. **Named table**: `FindingControlLink` (`finding_control_links`), not a
 *    generic `related_entity(type, id)`.
 * 2. **Real FK, `onDelete: Restrict`**: `schema.prisma`'s own
 *    `FindingControlLink.control` relation.
 * 3. **Port in `shared/grc-ports/`**: `ControlDirectoryPort` — already
 *    existed (Fase 3), reused unchanged; this is only the fourth consumer
 *    (`modules/risk`, `modules/compliance`, `modules/audit-engagements`,
 *    now `grc/finding`) and the FIRST case of a GRC-KERNEL capability
 *    (not a business module) depending on a `shared/grc-ports/` port —
 *    permitted by the existing lint boundary (`grc/**` -> `modules/**` is
 *    forbidden; `shared/**` is importable by everything).
 * 4. **Scope checked BEFORE any write**: `controlDirectory.findById`'s
 *    `orgUnitId`, checked against the actor's resolved scope, strictly
 *    before `transactionRunner.run` opens — mirrors
 *    `LinkControlUseCase`/`LinkRequirementToControlUseCase` exactly. A
 *    missing/inactive/out-of-scope control is `422` naming `controlId`,
 *    indistinguishable, and NOTHING is written
 *    (`test/integration/finding-control-link.spec.ts` proves the row
 *    count is unchanged).
 * 5. **Both permission halves**: `finding:link` (registering side, checked
 *    by `@RequirePermission` at the controller) AND `control:view`
 *    (referenced side, resolved here via `PermissionResolverService`,
 *    ADR-003's one decision path) — folded into the SAME `422` a
 *    nonexistent/inactive/out-of-scope control already produces, never a
 *    separate `403` branch (the exact form the 2026-09-08 ADR-020
 *    correction established for the two prior pairs, applied here from
 *    the first link rather than discovered later).
 *
 * `UnlinkFindingControlUseCase` deliberately does NOT repeat the
 * `control:view` check — the same exemption
 * `UnlinkControlUseCase`/`UnlinkRequirementFromControlUseCase` document:
 * the control behind `linkId` was already fully disclosed (id, code, name)
 * by `listFindingControlLinks`, gated by `finding:view` alone, which the
 * caller must already have read to obtain `linkId`.
 *
 * `Finding` carries no `version` column (data-model.md §7 of
 * 002-shared-grc-foundation) — no `If-Match`/`ETag` shape here, unlike
 * `LinkControlUseCase`'s own risk-side optimistic lock.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { OrgScopeEnforcerService } from '../../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import {
  ConflictDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { ControlDirectoryPort } from '../../../../shared/grc-ports/control-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { isOrgUnitWithinScope } from '../../../shared/domain/org-scope';
import { assertFindingEditable } from '../../domain/finding.entity';
import { FindingControlLinkRepositoryPort } from '../../domain/ports/finding-control-link-repository.port';
import { FindingReferenceDataPort } from '../../domain/ports/finding-reference-data.port';
import { FindingRepositoryPort } from '../../domain/ports/finding-repository.port';

import type { FindingControlLinkRecord } from '../../domain/finding-control-link.entity';

export interface LinkFindingControlInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly controlId: string;
}

@Injectable()
export class LinkFindingControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly linkRepository: FindingControlLinkRepositoryPort,
    private readonly controlDirectory: ControlDirectoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async execute(input: LinkFindingControlInput): Promise<FindingControlLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    // F-38: recorded server-side, via `assertExistingRecordAccessible`,
    // whenever the finding actually exists outside `scope`.
    const finding = await this.findingRepository.findById(scope, input.findingId);
    if (!finding) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.FINDING,
          entityId: input.findingId,
          entityLabel: USER_MESSAGES.findings.entityLabel,
        },
        () => this.findingRepository.findOrgUnitIdUnscoped(input.findingId),
      );
    }
    assertFindingEditable(finding.status);

    // ADR-020 parts 4+5 — checked BEFORE any write; a missing, inactive,
    // out-of-scope control and a control the actor lacks `control:view`
    // for all answer with the exact same refusal (see this file's header).
    const [control, canViewControl] = await Promise.all([
      this.controlDirectory.findById(input.controlId),
      this.permissionResolver.hasPermission(input.actorUserId, 'control:view'),
    ]);
    const controlOutOfScope = Boolean(
      control &&
      (control.orgUnitId === null
        ? scope.kind !== 'GLOBAL'
        : !isOrgUnitWithinScope(scope, control.orgUnitId)),
    );
    if (!control || !control.isActive || controlOutOfScope || !canViewControl) {
      throw new ValidationDomainError(USER_MESSAGES.findings.link.controlNotFound, [
        { field: 'controlId', message: USER_MESSAGES.findings.link.controlNotFound },
      ]);
    }

    const existing = await this.linkRepository.findActiveLink(input.findingId, input.controlId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.findings.link.controlAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.linkRepository.create(
        input.findingId,
        input.controlId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'finding_control_link.linked',
        entityType: AuditEntityType.FINDING_CONTROL_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { findingId: input.findingId, controlId: input.controlId },
        organizationalUnitId: finding.orgUnit.id,
      });

      return link;
    });
  }
}

export interface UnlinkFindingControlInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly linkId: string;
}

/**
 * ADR-020 part 5 deliberately NOT extended here — see this file's header,
 * "does NOT repeat the `control:view` check".
 */
@Injectable()
export class UnlinkFindingControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly findingRepository: FindingRepositoryPort,
    private readonly linkRepository: FindingControlLinkRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UnlinkFindingControlInput): Promise<FindingControlLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const finding = await this.findingRepository.findById(scope, input.findingId);
    if (!finding) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.FINDING,
          entityId: input.findingId,
          entityLabel: USER_MESSAGES.findings.entityLabel,
        },
        () => this.findingRepository.findOrgUnitIdUnscoped(input.findingId),
      );
    }
    assertFindingEditable(finding.status);

    const link = await this.linkRepository.findById(input.findingId, input.linkId);
    if (!link) {
      throw new NotFoundDomainError(USER_MESSAGES.findings.controlLinkEntityLabel, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      // Contract-level distinction (audit.openapi.yaml): an UNKNOWN linkId
      // is 404; an ALREADY-WITHDRAWN one is 422 — the two causes are
      // deliberately not folded into one here, unlike the control/risk
      // existence check above.
      throw new ValidationDomainError(USER_MESSAGES.findings.link.controlLinkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.findings.link.controlLinkAlreadyWithdrawn },
      ]);
    }

    return this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      const unlinked = await this.linkRepository.unlink(
        input.linkId,
        input.actorUserId,
        unlinkedAt,
      );

      await this.auditRecorder.record({
        action: 'finding_control_link.unlinked',
        entityType: AuditEntityType.FINDING_CONTROL_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: {
          findingId: input.findingId,
          controlId: link.control.id,
          unlinkedAt,
        },
        organizationalUnitId: finding.orgUnit.id,
      });

      return unlinked;
    });
  }
}

export interface ListFindingControlLinksInput {
  readonly actorUserId: string;
  readonly findingId: string;
  readonly includeWithdrawn: boolean;
}

@Injectable()
export class ListFindingControlLinksUseCase {
  constructor(
    private readonly findingRepository: FindingRepositoryPort,
    private readonly linkRepository: FindingControlLinkRepositoryPort,
    private readonly referenceData: FindingReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: ListFindingControlLinksInput): Promise<readonly FindingControlLinkRecord[]> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const finding = await this.findingRepository.findById(scope, input.findingId);
    if (!finding) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.FINDING,
          entityId: input.findingId,
          entityLabel: USER_MESSAGES.findings.entityLabel,
        },
        () => this.findingRepository.findOrgUnitIdUnscoped(input.findingId),
      );
    }

    return this.linkRepository.listByFinding(input.findingId, input.includeWithdrawn);
  }
}
