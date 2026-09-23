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

    await this.complianceReader.deriveForOne(input.requirementId, linkedAt);

    return link;
  }
}

export interface UnlinkRequirementFromControlInput {
  readonly actorUserId: string;
  readonly requirementId: string;
  readonly linkId: string;
}

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

    await this.complianceReader.deriveForOne(input.requirementId, unlinkedAt);
  }
}
