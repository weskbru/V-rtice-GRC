/**
 * 008-incidents-problems, US2 — `CreateProblemUseCase` (`POST /problems`,
 * `createProblem` operation, spec.md FR-001 to FR-003). Mirrors
 * `modules/controls/application/create-control.usecase.ts`'s structure —
 * see that file's header for the transaction-boundary/order-of-checks
 * reasoning this one does not repeat.
 *
 * ## Owner defaults to the caller, unlike Control's optional owner
 *
 * `ownerUserId` may be omitted (`CreateProblemRequest`'s own `required`
 * list excludes it, description: "Defaults to the caller when omitted.")
 * — but `problems.owner_user_id` is `NOT NULL` (data-model.md §1), unlike
 * `Control`'s genuinely optional owner. So an omitted `ownerUserId` here
 * becomes `input.actorUserId`, never `undefined` — the owner is always
 * validated (existence, active, assignable to `orgUnitId`'s line), never
 * skipped the way `CreateControlUseCase` skips validation for a truly
 * absent owner.
 *
 * ## Code generation reuses the GRC kernel's shared allocator
 *
 * `EntityCodeGeneratorPort.nextCode('PRB', year)` — the same allocator
 * `Evidence`/`Action`/`Finding`/`Control`/... already use (data-model.md
 * §3's own account of the `PRB` prefix addition). Never a second,
 * duplicated counter mechanism in this module.
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
import { ProblemReferenceDataPort } from '../domain/ports/problem-reference-data.port';
import { ProblemRepositoryPort } from '../domain/ports/problem-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ProblemRecord } from '../domain/ports/problem-repository.port';
import type { ProblemSeverity } from '@prisma/client';

export interface CreateProblemInput {
  readonly actorUserId: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ProblemSeverity;
  readonly orgUnitId: string;
  readonly ownerUserId?: string | undefined;
  readonly identifiedOn: Date;
}

@Injectable()
export class CreateProblemUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly problemRepository: ProblemRepositoryPort,
    private readonly referenceData: ProblemReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly assignmentLine: AssignmentLineService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateProblemInput): Promise<ProblemRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      // Defensive only: `SessionGuard` already proved this user has a
      // live session, so the actor row existing is expected. Fails
      // closed rather than attributing an audit event to a fabricated
      // label — mirrors `CreateControlUseCase`'s own identical check.
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    await this.assertOrgUnitCreatable(scope, input.orgUnitId);

    const ownerUserId = input.ownerUserId ?? input.actorUserId;
    const assignableUnitIds =
      (await this.assignmentLine.resolveUnitIds(input.orgUnitId)) ?? new Set<string>();
    await this.assertOwnerAssignable(ownerUserId, assignableUnitIds);

    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('PRB', codeYear);

      const record = await this.problemRepository.create({
        code,
        title: input.title,
        description: input.description,
        severity: input.severity,
        orgUnitId: input.orgUnitId,
        ownerUserId,
        identifiedOn: input.identifiedOn,
      });

      await this.auditRecorder.record({
        action: 'problem.created',
        entityType: AuditEntityType.PROBLEM,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          title: input.title,
          description: input.description,
          severity: input.severity,
          orgUnitId: input.orgUnitId,
          ownerUserId,
          identifiedOn: input.identifiedOn,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(scope: ScopeFilter, orgUnitId: string): Promise<void> {
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.problems.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.problems.orgUnitNotFound },
      ]);
    }

    if (!isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.problems.orgUnitOutOfScope, [
        { field: 'orgUnitId', message: USER_MESSAGES.problems.orgUnitOutOfScope },
      ]);
    }
  }

  private async assertOwnerAssignable(
    ownerUserId: string,
    assignmentLine: ReadonlySet<string>,
  ): Promise<void> {
    const owner = await this.referenceData.findUser(ownerUserId);
    if (!owner?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.problems.ownerNotFound, [
        { field: 'ownerUserId', message: USER_MESSAGES.problems.ownerNotFound },
      ]);
    }
    if (owner.primaryOrgUnitId !== undefined && !assignmentLine.has(owner.primaryOrgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.problems.ownerNotAssignable, [
        { field: 'ownerUserId', message: USER_MESSAGES.problems.ownerNotAssignable },
      ]);
    }
  }
}

/** Mirrors `create-control.usecase.ts`'s own exported
 * `isOrgUnitWithinScope` — not imported from there (`modules/controls` and
 * `modules/problems` must not depend on each other). */
export function isOrgUnitWithinScope(scope: ScopeFilter, orgUnitId: string): boolean {
  return scope.kind === 'GLOBAL' || scope.unitIds.has(orgUnitId);
}
