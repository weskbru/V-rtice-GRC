import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../../../core/authorization/application/permission-resolver.service';
import { isOrgUnitWithinScope } from '../../../../grc/shared/domain/org-scope';
import {
  ConflictDomainError,
  NotFoundDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { ProcessDirectoryPort } from '../../../../shared/grc-ports/process-directory.port';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { assertControlAcceptsNewLink } from '../../domain/control-relationship.entity';
import { ControlProcessLinkRepositoryPort } from '../../domain/ports/control-relationship-repository.port';
import { ControlAccessResolver } from '../control-access-resolver.service';

import type { ControlEntityLinkRecord } from '../../domain/ports/control-relationship-repository.port';

const LINK_ENTITY_LABEL = 'Vínculo com processo';

export interface LinkControlToProcessInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly processId: string;
}

@Injectable()
export class LinkControlToProcessUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlAccess: ControlAccessResolver,
    private readonly processLinkRepository: ControlProcessLinkRepositoryPort,
    private readonly processDirectory: ProcessDirectoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: LinkControlToProcessInput): Promise<ControlEntityLinkRecord> {
    const actor = await this.controlAccess.resolveActor(input.actorUserId);
    const { scope, control } = await this.controlAccess.resolveControl(
      input.actorUserId,
      input.controlId,
    );

    assertControlAcceptsNewLink(control.status);

    const [process, canViewProcess] = await Promise.all([
      this.processDirectory.findById(input.processId),
      this.permissionResolver.hasPermission(input.actorUserId, 'process:view'),
    ]);
    const processOutOfScope = Boolean(
      process &&
      (process.orgUnitId === null
        ? scope.kind !== 'GLOBAL'
        : !isOrgUnitWithinScope(scope, process.orgUnitId)),
    );
    if (!process || !process.isActive || processOutOfScope || !canViewProcess) {
      throw new NotFoundDomainError(USER_MESSAGES.controls.processEntityLabel, input.processId);
    }

    const existing = await this.processLinkRepository.findActiveLink(
      input.controlId,
      input.processId,
    );
    if (existing) {
      throw new ConflictDomainError(USER_MESSAGES.controls.relationships.processAlreadyLinked);
    }

    return this.transactionRunner.run(async () => {
      const link = await this.processLinkRepository.create(
        input.controlId,
        input.processId,
        input.actorUserId,
      );

      await this.auditRecorder.record({
        action: 'control.process_linked',
        entityType: AuditEntityType.CONTROL_PROCESS_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { controlId: input.controlId, processId: input.processId },
        organizationalUnitId: control.orgUnitId,
      });

      return link;
    });
  }
}

export interface UnlinkControlFromProcessInput {
  readonly actorUserId: string;
  readonly controlId: string;
  readonly linkId: string;
}

@Injectable()
export class UnlinkControlFromProcessUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlAccess: ControlAccessResolver,
    private readonly processLinkRepository: ControlProcessLinkRepositoryPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: UnlinkControlFromProcessInput): Promise<void> {
    const actor = await this.controlAccess.resolveActor(input.actorUserId);
    const { control } = await this.controlAccess.resolveControl(input.actorUserId, input.controlId);

    const link = await this.processLinkRepository.findById(input.controlId, input.linkId);
    if (!link) {
      throw new NotFoundDomainError(LINK_ENTITY_LABEL, input.linkId);
    }
    if (link.unlinkedAt !== undefined) {
      throw new ValidationDomainError(USER_MESSAGES.controls.relationships.linkAlreadyWithdrawn, [
        { field: 'linkId', message: USER_MESSAGES.controls.relationships.linkAlreadyWithdrawn },
      ]);
    }

    await this.transactionRunner.run(async () => {
      const unlinkedAt = new Date();
      await this.processLinkRepository.unlink(input.linkId, input.actorUserId, unlinkedAt);

      await this.auditRecorder.record({
        action: 'control.process_unlinked',
        entityType: AuditEntityType.CONTROL_PROCESS_LINK,
        entityId: link.id,
        actorLabel: actor.fullName,
        newValues: { controlId: input.controlId, processId: link.entity.id, unlinkedAt },
        organizationalUnitId: control.orgUnitId,
      });
    });
  }
}
