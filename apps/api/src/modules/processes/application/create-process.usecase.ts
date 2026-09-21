/**
 * T019/006-assets-processes — `CreateProcessUseCase`: identical in shape to
 * `modules/assets/application/create-asset.usecase.ts` (FR-020) — see that
 * file's header for the full account this one does not repeat. Uses the
 * `PRC` code prefix.
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../grc/shared/domain/org-scope';
import { EntityCodeGeneratorPort } from '../../../grc/shared/domain/ports/entity-code-generator.port';
import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { ProcessReferenceDataPort } from '../domain/ports/process-reference-data.port';
import { ProcessRepositoryPort } from '../domain/ports/process-repository.port';
import {
  assertProcessNameProvided,
  assertProcessOrgUnitInScope,
  assertProcessOrgUnitProvided,
} from '../domain/process.entity';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { ProcessRecord } from '../domain/ports/process-repository.port';

export interface CreateProcessInput {
  readonly actorUserId: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly orgUnitId: string;
}

@Injectable()
export class CreateProcessUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly processRepository: ProcessRepositoryPort,
    private readonly referenceData: ProcessReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateProcessInput): Promise<ProcessRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    assertProcessNameProvided(input.name);
    assertProcessOrgUnitProvided(input.orgUnitId);

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    await this.assertOrgUnitCreatable(scope, input.orgUnitId);

    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('PRC', codeYear);

      const record = await this.processRepository.create({
        code,
        name: input.name,
        description: input.description,
        orgUnitId: input.orgUnitId,
      });

      await this.auditRecorder.record({
        action: 'process.created',
        entityType: AuditEntityType.PROCESS,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          code,
          name: input.name,
          description: input.description ?? null,
          orgUnitId: input.orgUnitId,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(scope: ScopeFilter, orgUnitId: string): Promise<void> {
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    const isUsable = Boolean(orgUnit?.isActive) && isOrgUnitWithinScope(scope, orgUnitId);
    assertProcessOrgUnitInScope(isUsable);
  }
}
