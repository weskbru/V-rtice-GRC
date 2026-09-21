/**
 * T037/003-controls-management, User Story 3 — `LinkControlToProcessUseCase`/
 * `UnlinkControlFromProcessUseCase`. `POST`/`DELETE
 * /controls/{controlId}/processes[/{linkId}]`
 * (`linkControlToProcess`/`unlinkControlFromProcess` operations). Both
 * gated by `control:edit` on the controller route (ADR-020 part 5: the
 * permission of the side that registers the link).
 *
 * ## ADR-020 part 4 — the target's scope is checked BEFORE the write, and
 * nothing is written otherwise
 *
 * `processRegistry.findById` plus `isOrgUnitWithinScope` run to completion
 * — and the use case returns via `NotFoundDomainError` — strictly BEFORE
 * `transactionRunner.run` opens. There is no code path in this file that
 * reaches a database write for a target this check has rejected: the
 * `create` call sits textually and causally after every validation branch
 * that can still throw, so a check performed "after" is not a shape this
 * file can produce even by omission (see `test/integration/
 * control-relationship-links.spec.ts` for the test that verifies zero rows
 * are ever written for a rejected target).
 *
 * ## T036/006-assets-processes — `ProcessDirectoryPort`, not
 * `ProcessRegistryLookupPort`/`reference-registry-lookup.repository.ts`
 *
 * `Process` is now a business-module domain owned by `modules/processes`
 * (data-model.md §8, Constitution Principle I) — see
 * `control-asset-link.usecase.ts`'s own header for the full account this
 * file mirrors exactly, replacing "asset" with "process".
 */
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

    // ADR-020 part 4 — checked BEFORE any write; a missing, inactive or
    // out-of-scope process answers exactly as nonexistent (FR-025). A
    // process with `orgUnitId === null` is visible only to a caller with
    // `GLOBAL` scope — mirrors `LinkControlUseCase`'s own null-handling
    // exactly (`modules/risk/application/links/control-link.usecase.ts`).
    //
    // ADR-020 part 5 (006-assets-processes, FR-011) — `process:view` on the
    // REFERENCED side. See `control-asset-link.usecase.ts`'s twin comment
    // for why this was NOT left deferred: "this pair already had part 4" is
    // the same reasoning that made F-46 close one sibling and leave two.
    // Folded into the SAME single refusal below.
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
