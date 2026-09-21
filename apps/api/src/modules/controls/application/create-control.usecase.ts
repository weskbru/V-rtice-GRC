/**
 * T020/003-controls-management — `CreateControlUseCase` (`POST /controls`,
 * `createControl` operation, FR-001-FR-003, FR-005, FR-008, FR-029/FR-030).
 * Mirrors `modules/risk/application/create-risk.usecase.ts`'s structure —
 * see that file's header for the transaction-boundary/order-of-checks
 * reasoning this one does not repeat.
 *
 * ## Owner is OPTIONAL here, unlike Risk's required owner
 *
 * `ownerUserId` may be omitted or `null` (FR-005, edge case "controle sem
 * dono"): a control may be drafted before responsibility is decided. It is
 * validated — existence, active, assignable to `orgUnitId`'s line — ONLY
 * when supplied; entering `ACTIVE` is where the owner becomes mandatory
 * (`domain/control-lifecycle.ts`'s `HAS_OWNER` precondition,
 * `PerformControlTransitionUseCase`).
 *
 * ## Code generation reuses the GRC kernel's shared allocator
 *
 * `EntityCodeGeneratorPort.nextCode('CTL', year)` — the SAME allocator
 * (`GrcCodeSequence`) Evidence/Action/Finding already use, extended with
 * the `CTL` prefix at T019a (data-model.md §1's own account of why this is
 * the right reuse despite `Control` not being a GRC-kernel entity). Never a
 * second, duplicated counter mechanism in this module.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { AssignmentLineService } from '../../../core/organizations/application/assignment-line.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { EntityCodeGeneratorPort } from '../../../grc/shared/domain/ports/entity-code-generator.port';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { registerControlAuditAllowlists } from '../domain/control-audit-allowlist';
import { ControlReferenceDataPort } from '../domain/ports/control-reference-data.port';
import { ControlRepositoryPort } from '../domain/ports/control-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ControlRecord } from '../domain/ports/control-repository.port';
import type { ControlFrequency, ControlNature, ControlType } from '@prisma/client';

export interface CreateControlInput {
  readonly actorUserId: string;
  readonly name: string;
  readonly description: string;
  readonly orgUnitId: string;
  readonly ownerUserId?: string | null | undefined;
  readonly nature?: ControlNature | null | undefined;
  readonly type?: ControlType | null | undefined;
  readonly frequency?: ControlFrequency | null | undefined;
}

@Injectable()
export class CreateControlUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly controlRepository: ControlRepositoryPort,
    private readonly referenceData: ControlReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly assignmentLine: AssignmentLineService,
    private readonly auditRecorder: AuditRecorder,
  ) {
    // Idempotent — see that function's own doc comment. Called here rather
    // than from `ControlsModule`'s constructor because this task does not
    // own that file (see this task's report for the exact call the
    // coordinator must add there instead, mirroring `RiskModule`'s own
    // `registerRiskAuditAllowlists()` call).
    registerControlAuditAllowlists();
  }

  async execute(input: CreateControlInput): Promise<ControlRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      // Defensive only: `SessionGuard` already proved this user has a live
      // session, so the actor row existing is expected. Fails closed
      // rather than attributing an audit event to a fabricated label —
      // mirrors `CreateRiskUseCase`'s own identical check.
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    await this.assertOrgUnitCreatable(scope, input.orgUnitId);

    const ownerUserId = input.ownerUserId ?? undefined;
    if (ownerUserId) {
      const assignableUnitIds =
        (await this.assignmentLine.resolveUnitIds(input.orgUnitId)) ?? new Set<string>();
      await this.assertOwnerAssignable(ownerUserId, assignableUnitIds);
    }

    const nature = input.nature ?? undefined;
    const type = input.type ?? undefined;
    const frequency = input.frequency ?? undefined;
    const codeYear = new Date().getUTCFullYear();
    const referenceDate = new Date();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('CTL', codeYear);

      const record = await this.controlRepository.create(
        {
          code,
          name: input.name,
          description: input.description,
          orgUnitId: input.orgUnitId,
          ownerUserId,
          nature,
          type,
          frequency,
        },
        referenceDate,
      );

      await this.auditRecorder.record({
        action: 'control.created',
        entityType: AuditEntityType.CONTROL,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          name: input.name,
          description: input.description,
          orgUnitId: input.orgUnitId,
          ownerUserId: ownerUserId ?? null,
          nature: nature ?? null,
          type: type ?? null,
          frequency: frequency ?? null,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(scope: ScopeFilter, orgUnitId: string): Promise<void> {
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.controls.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.controls.orgUnitNotFound },
      ]);
    }

    if (!isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.controls.orgUnitOutOfScope, [
        { field: 'orgUnitId', message: USER_MESSAGES.controls.orgUnitOutOfScope },
      ]);
    }
  }

  private async assertOwnerAssignable(
    ownerUserId: string,
    assignmentLine: ReadonlySet<string>,
  ): Promise<void> {
    const owner = await this.referenceData.findUser(ownerUserId);
    if (!owner?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.controls.ownerNotFound, [
        { field: 'ownerUserId', message: USER_MESSAGES.controls.ownerNotFound },
      ]);
    }
    if (owner.primaryOrgUnitId !== undefined && !assignmentLine.has(owner.primaryOrgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.controls.ownerNotAssignable, [
        { field: 'ownerUserId', message: USER_MESSAGES.controls.ownerNotAssignable },
      ]);
    }
  }
}

/** FR-025c-equivalent predicate, shared verbatim by `UpdateControlUseCase`
 * — mirrors `create-risk.usecase.ts`'s own exported
 * `isOrgUnitWithinScope`. */
export function isOrgUnitWithinScope(scope: ScopeFilter, orgUnitId: string): boolean {
  return scope.kind === 'GLOBAL' || scope.unitIds.has(orgUnitId);
}
