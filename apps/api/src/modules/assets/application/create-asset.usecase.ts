import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import { isOrgUnitWithinScope } from '../../../grc/shared/domain/org-scope';
import { EntityCodeGeneratorPort } from '../../../grc/shared/domain/ports/entity-code-generator.port';
import { UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import {
  assertAssetNameProvided,
  assertAssetOrgUnitInScope,
  assertAssetOrgUnitProvided,
} from '../domain/asset.entity';
import { AssetReferenceDataPort } from '../domain/ports/asset-reference-data.port';
import { AssetRepositoryPort } from '../domain/ports/asset-repository.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { AssetRecord } from '../domain/ports/asset-repository.port';

export interface CreateAssetInput {
  readonly actorUserId: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly orgUnitId: string;
}

@Injectable()
export class CreateAssetUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly assetRepository: AssetRepositoryPort,
    private readonly referenceData: AssetReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateAssetInput): Promise<AssetRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    assertAssetNameProvided(input.name);
    assertAssetOrgUnitProvided(input.orgUnitId);

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    await this.assertOrgUnitCreatable(scope, input.orgUnitId);

    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('AST', codeYear);

      const record = await this.assetRepository.create({
        code,
        name: input.name,
        description: input.description,
        orgUnitId: input.orgUnitId,
      });

      await this.auditRecorder.record({
        action: 'asset.created',
        entityType: AuditEntityType.ASSET,
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
    assertAssetOrgUnitInScope(isUsable);
  }
}
