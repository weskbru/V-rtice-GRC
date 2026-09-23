import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { parseIsoDate } from '../../shared/domain/iso-date';
import { isOrgUnitWithinScope } from '../../shared/domain/org-scope';
import { EntityCodeGeneratorPort } from '../../shared/domain/ports/entity-code-generator.port';
import {
  assertEvidenceHasSubstance,
  assertValidUntilNotBeforeCollectedOn,
} from '../domain/evidence.entity';
import { EvidenceReferenceDataPort } from '../domain/ports/evidence-reference-data.port';
import { EvidenceRepositoryPort } from '../domain/ports/evidence-repository.port';

import type { EvidenceRecord } from '../domain/ports/evidence-repository.port';
import type { EvidenceSource, EvidenceType } from '@prisma/client';

export interface CreateEvidenceInput {
  readonly actorUserId: string;
  readonly orgUnitId: string;
  readonly title: string;
  readonly description?: string | undefined;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly ownerUserId: string;
  readonly collectedOn: string;
  readonly validUntil?: string | undefined;
  readonly externalUrl?: string | undefined;
  readonly observation?: string | undefined;
}

@Injectable()
export class CreateEvidenceUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly evidenceRepository: EvidenceRepositoryPort,
    private readonly referenceData: EvidenceReferenceDataPort,
    private readonly codeGenerator: EntityCodeGeneratorPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async execute(input: CreateEvidenceInput): Promise<EvidenceRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    await this.assertOrgUnitCreatable(scope, input.orgUnitId);

    const owner = await this.referenceData.findUser(input.ownerUserId);
    if (!owner?.isActive) {
      throw new ValidationDomainError(USER_MESSAGES.evidence.ownerNotFound, [
        { field: 'ownerUserId', message: USER_MESSAGES.evidence.ownerNotFound },
      ]);
    }

    assertEvidenceHasSubstance({
      externalUrl: input.externalUrl,
      observation: input.observation,
    });

    const collectedOn = parseIsoDate(input.collectedOn);
    const validUntil = input.validUntil ? parseIsoDate(input.validUntil) : undefined;
    assertValidUntilNotBeforeCollectedOn(collectedOn, validUntil);

    const codeYear = new Date().getUTCFullYear();

    return this.transactionRunner.run(async () => {
      const code = await this.codeGenerator.nextCode('EVD', codeYear);

      const record = await this.evidenceRepository.create({
        code,
        orgUnitId: input.orgUnitId,
        title: input.title,
        description: input.description,
        type: input.type,
        source: input.source,
        ownerUserId: input.ownerUserId,
        collectedOn,
        validUntil,
        externalUrl: input.externalUrl,
        observation: input.observation,
      });

      await this.auditRecorder.record({
        action: 'evidence.created',
        entityType: AuditEntityType.EVIDENCE,
        entityId: record.id,
        actorLabel: actor.fullName,
        newValues: {
          orgUnitId: input.orgUnitId,
          title: input.title,
          description: input.description ?? null,
          type: input.type,
          source: input.source,
          ownerUserId: input.ownerUserId,
          collectedOn,
          validUntil: validUntil ?? null,
          externalUrl: input.externalUrl ?? null,
          observation: input.observation ?? null,
        },
        organizationalUnitId: input.orgUnitId,
      });

      return record;
    });
  }

  private async assertOrgUnitCreatable(
    scope: Awaited<ReturnType<ScopeResolverService['resolveScope']>>,
    orgUnitId: string,
  ): Promise<void> {
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive || !isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.evidence.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.evidence.orgUnitNotFound },
      ]);
    }
  }
}
