/**
 * T051/002-shared-grc-foundation, US2 — `CreateActionUseCase` (`createAction`,
 * FR-011-FR-013, FR-031, R-001, ADR-005). Mirrors
 * `grc/evidence/application/create-evidence.usecase.ts`'s shape — see that
 * file's header for the transaction-boundary reasoning this one does not
 * repeat.
 *
 * ## Order of checks
 *
 * 1. Actor must exist.
 * 2. Origin: `getActionOriginAccessor(originType).resolveEditableOrigin(...)`
 *    — throws `NotFoundDomainError` for a nonexistent origin, one outside
 *    the actor's scope, or one the actor may not EDIT (FR-031). This is the
 *    ONE check `createAction`'s own contract description names: "Requires
 *    `action:create`, plus edit permission and scope on the origin record —
 *    work is created by whoever may act on the thing it arises from."
 *    `action:create` itself is checked by `@RequirePermission` at the
 *    controller boundary, never here.
 * 3. `responsibleUserId` must exist and be active (referential integrity).
 *
 * `Action.orgUnitId` is NOT caller-supplied — it is the origin's own
 * organizational unit (`ActionOriginAccess.organizationalUnitId`), the same
 * reason `ActionReferenceDataPort` carries no `findOrgUnit`.
 *
 * ## Reused verbatim by the `RISK_TREATMENT` convergence write (R-003/T055)
 *
 * `modules/risk/application/treatment-actions/create-treatment-action
 * .usecase.ts` calls THIS use case directly (not `POST /actions`) from
 * inside its own already-open transaction — nested `TransactionRunnerPort
 * .run(...)` calls join the same ambient transaction
 * (`PrismaService.runInTransaction`'s own documented contract), so both
 * writes commit or roll back together. Because that call bypasses this
 * capability's own controller, `action:create` is never re-checked for the
 * risk module's caller — the SAME reasoning `data-model.md §7`/R-003
 * documents: the actor already proved `risk:treat` (which
 * `RiskActionOriginAccessor` re-derives via step 2 above, since `originType
 * = RISK_TREATMENT`/`originId = riskId`), and that IS the authority this
 * use case requires to create the mirrored `Action`.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { parseIsoDate } from '../../shared/domain/iso-date';
import { getActionOriginAccessor } from '../../shared/domain/ports/action-origin-resolver.port';
import { EntityCodeGeneratorPort } from '../../shared/domain/ports/entity-code-generator.port';
import { ActionReferenceDataPort } from '../domain/ports/action-reference-data.port';
import { ActionRepositoryPort } from '../domain/ports/action-repository.port';

import type { ActionRecord } from '../domain/ports/action-repository.port';
import type { ActionOriginType } from '@prisma/client';

export interface CreateActionInput {
  readonly actorUserId: string;
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly title: string;
  readonly description?: string | undefined;
  readonly responsibleUserId: string;
  readonly dueOn: string;
}

export interface CreateActionResult {
  readonly record: ActionRecord;
  readonly originLabel: string;
}

@Injectable()
export class CreateActionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly actionRepository: ActionRepositoryPort,
    private readonly referenceData: ActionReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateActionInput): Promise<CreateActionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    // Origin side — existence, scope, EDIT permission, all in one call
    // (FR-031; see this file's own header). Throws NotFoundDomainError for
    // every reason the actor may not proceed (SC-005).
    const origin = await getActionOriginAccessor(input.originType).resolveEditableOrigin(
      input.actorUserId,
      input.originId,
    );

    const responsible = await this.referenceData.findUser(input.responsibleUserId);
    if (!responsible?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.action.responsibleNotFound, [
        { field: 'responsibleUserId', message: USER_MESSAGES.action.responsibleNotFound },
      ]);
    }

    // Invariant A3 — `dueOn` in the past is accepted (FR-013), so no
    // assertion runs here at all: the value is simply parsed and stored.
    const dueOn = parseIsoDate(input.dueOn);
    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('ACT', codeYear);

      const record = await this.actionRepository.create({
        code,
        orgUnitId: origin.organizationalUnitId,
        originType: input.originType,
        originId: input.originId,
        title: input.title,
        description: input.description,
        responsibleUserId: input.responsibleUserId,
        dueOn,
      });

      await this.auditRecorder.record({
        action: 'action.created',
        entityType: AuditEntityType.ACTION,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          originType: input.originType,
          originId: input.originId,
          title: input.title,
          description: input.description ?? null,
          responsibleUserId: input.responsibleUserId,
          dueOn,
          status: record.status,
        },
        organizationalUnitId: origin.organizationalUnitId,
      });

      return { record, originLabel: origin.label };
    });
  }
}
