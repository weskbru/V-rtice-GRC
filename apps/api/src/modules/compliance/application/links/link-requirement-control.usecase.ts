/**
 * T032/T033/004-compliance-management, User Story 2 —
 * `LinkRequirementToControlUseCase`. `POST
 * /requirements/{requirementId}/controls` (`linkRequirementToControl`
 * operation, FR-008, FR-010, FR-022, ADR-020).
 *
 * ## ADR-020 part 4, finally exercised — scope checked BEFORE the write,
 * and NOTHING is written otherwise
 *
 * `controlDirectory.findById` plus the scope check run to completion —
 * and the use case throws `ValidationDomainError` (422) — strictly BEFORE
 * `transactionRunner.run` opens. There is no code path in this file that
 * reaches `linkRepository.create` for a control this check has rejected:
 * the write call sits textually and causally after every branch that can
 * still throw, mirroring `LinkControlToProcessUseCase`
 * (`modules/controls/application/links/control-process-link.usecase.ts`)'s
 * own documented shape for the identical guarantee. A missing control and
 * an out-of-scope one answer with the exact same `ValidationDomainError`
 * (SC-005, FR-022) — no branch distinguishes them by message or by any
 * other observable signal.
 *
 * A control with `orgUnitId === null` is treated as visible only to a
 * caller with `GLOBAL` scope — `isOrgUnitWithinScope` itself takes a
 * non-null unit id, so this file guards the null case explicitly rather
 * than calling it with a value it was never designed to accept.
 *
 * ## ADR-020 part 5, both halves - `control:view` on the referenced side
 *
 * Until this task, only `compliance:map` (the registering side, checked by
 * `RequirementControlLinkController`'s `@RequirePermission`) was enforced -
 * ADR-020's own "Verificação em código" addenda said so plainly. This adds
 * the missing half: `control:view` on the referenced control, resolved via
 * `PermissionResolverService` (ADR-003's one decision path), the same
 * mechanism `GetDashboardUseCase`/`GetRiskLifecycleUseCase` already use to
 * vary behaviour by permission, and the same mechanism
 * `LinkControlUseCase` (`modules/risk/application/links/control-link.usecase.ts`)
 * now uses for the Risk -> Control pair. Folded into the SAME condition as
 * the existing missing/inactive/out-of-scope check below, not a second
 * branch - a caller lacking `control:view` gets the identical
 * `ValidationDomainError`/message a nonexistent or out-of-scope control
 * already produces. `UnlinkRequirementFromControlUseCase` deliberately does
 * NOT repeat this check - see its own comment for why.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
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
import { registerComplianceAuditAllowlists } from '../../domain/compliance-audit-allowlist';
import { ComplianceReferenceDataPort } from '../../domain/ports/compliance-reference-data.port';
import { RequirementControlLinkRepositoryPort } from '../../domain/ports/requirement-control-link-repository.port';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';
import { RequirementComplianceReaderService } from '../requirement-compliance-reader.service';

import type { ControlDirectoryEntry } from '../../../../shared/grc-ports/control-directory.port';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { RequirementControlLinkRecord } from '../../domain/requirement-control-link.entity';

export interface LinkRequirementToControlInput {
  readonly actorUserId: string;
  readonly requirementId: string;
  readonly controlId: string;
}

function isControlWithinScope(scope: ScopeFilter, control: ControlDirectoryEntry): boolean {
  if (scope.kind === 'GLOBAL') {
    return true;
  }
  return control.orgUnitId !== null && scope.unitIds.has(control.orgUnitId);
}

@Injectable()
export class LinkRequirementToControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly linkRepository: RequirementControlLinkRepositoryPort,
    private readonly controlDirectory: ControlDirectoryPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
    private readonly complianceReader: RequirementComplianceReaderService,
    private readonly permissionResolver: PermissionResolverService,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: LinkRequirementToControlInput): Promise<RequirementControlLinkRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const requirement = await this.requirementRepository.findById(input.requirementId);
    if (!requirement) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.requirementEntityLabel,
        input.requirementId,
      );
    }

    // ADR-020 part 4 — checked BEFORE any write; a missing or
    // out-of-scope control answers exactly as nonexistent (FR-022,
    // SC-005), via the SAME error/status a nonexistent one would produce.
    // ADR-020 part 5 (both halves, see this file's header) — a control the
    // actor lacks `control:view` for answers identically, folded into this
    // same condition rather than a second branch.
    const [scope, control, canViewControl] = await Promise.all([
      this.scopeResolver.resolveScope(input.actorUserId),
      this.controlDirectory.findById(input.controlId),
      this.permissionResolver.hasPermission(input.actorUserId, 'control:view'),
    ]);
    if (!control || !control.isActive || !isControlWithinScope(scope, control) || !canViewControl) {
      throw new ValidationDomainError(
        USER_MESSAGES.compliance.requirementControlLink.controlNotFoundOrOutOfScope,
        [
          {
            field: 'controlId',
            message: USER_MESSAGES.compliance.requirementControlLink.controlNotFoundOrOutOfScope,
          },
        ],
      );
    }

    const existing = await this.linkRepository.findActiveLink(input.requirementId, input.controlId);
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.compliance.requirementControlLink.alreadyLinked);
    }

    const linkedAt = new Date();
    const link = await this.transactionRunner.run(async () => {
      const created = await this.linkRepository.create(
        input.requirementId,
        input.controlId,
        input.actorUserId,
        linkedAt,
      );

      await this.auditRecorder.record({
        action: 'compliance.requirement_control_linked',
        entityType: AuditEntityType.REQUIREMENT_CONTROL_LINK,
        entityId: created.id,
        actorLabel: actor.fullName,
        newValues: {
          requirementId: input.requirementId,
          controlId: input.controlId,
          linkedAt,
        },
      });

      return created;
    });

    // research.md D-11 — linking is a write that can affect this
    // requirement's compliance state; the reader's own side effect
    // (best-effort, never throws) audits the change if one occurred.
    await this.complianceReader.deriveForOne(input.requirementId, linkedAt);

    return link;
  }
}

export interface UnlinkRequirementFromControlInput {
  readonly actorUserId: string;
  readonly requirementId: string;
  readonly linkId: string;
}

/**
 * ADR-020 part 5 deliberately NOT extended here, for the same reason
 * `UnlinkControlUseCase` (`modules/risk/application/links/control-link.usecase.ts`)
 * documents for its own unlink path. `UnlinkRequirementFromControlUseCase`
 * takes no `controlId` from the caller - it resolves `linkId` against
 * `linkRepository.findById(requirementId, linkId)`, an identifier the
 * caller can only already hold from `GET /requirements/{requirementId}/controls`
 * (gated by `compliance:view`, not `control:view`), which itself returns
 * the linked control's id/code/name
 * (`toRequirementControlLinkResponse`/`RequirementControlLinkRecord.control`).
 * Refusing unlink for a missing `control:view` would add no oracle this
 * caller does not already have from the list they got `linkId` from -
 * part 5's own wording ("Criar o vínculo exige...") scopes the
 * dual-permission requirement to creation.
 */
@Injectable()
export class UnlinkRequirementFromControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly linkRepository: RequirementControlLinkRepositoryPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
    private readonly complianceReader: RequirementComplianceReaderService,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: UnlinkRequirementFromControlInput): Promise<void> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const requirement = await this.requirementRepository.findById(input.requirementId);
    if (!requirement) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.requirementEntityLabel,
        input.requirementId,
      );
    }

    const link = await this.linkRepository.findById(input.requirementId, input.linkId);
    if (!link) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.requirementControlLinkEntityLabel,
        input.linkId,
      );
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(
        USER_MESSAGES.compliance.requirementControlLink.alreadyWithdrawn,
        [
          {
            field: 'linkId',
            message: USER_MESSAGES.compliance.requirementControlLink.alreadyWithdrawn,
          },
        ],
      );
    }

    const unlinkedAt = new Date();
    await this.transactionRunner.run(async () => {
      await this.linkRepository.unlink(input.linkId, input.actorUserId, unlinkedAt);

      await this.auditRecorder.record({
        action: 'compliance.requirement_control_unlinked',
        entityType: AuditEntityType.REQUIREMENT_CONTROL_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: {
          requirementId: input.requirementId,
          controlId: link.control.id,
          unlinkedAt,
        },
      });
    });

    // research.md D-11 — same reasoning as `LinkRequirementToControlUseCase`.
    await this.complianceReader.deriveForOne(input.requirementId, unlinkedAt);
  }
}
