import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { OrgScopeEnforcerService } from '../../../core/organizations/application/org-scope-enforcer.service';
import { ScopeResolverService } from '../../../core/organizations/application/scope-resolver.service';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { parseIsoDate } from '../../shared/domain/iso-date';
import {
  assertEvidenceEditable,
  assertEvidenceHasSubstance,
  assertValidUntilNotBeforeCollectedOn,
} from '../domain/evidence.entity';
import { EvidenceReferenceDataPort } from '../domain/ports/evidence-reference-data.port';
import { EvidenceRepositoryPort } from '../domain/ports/evidence-repository.port';

import type {
  EvidenceRecord,
  UpdateEvidenceChanges,
} from '../domain/ports/evidence-repository.port';
import type { EvidenceSource, EvidenceType } from '@prisma/client';

export interface UpdateEvidenceInput {
  readonly actorUserId: string;
  readonly evidenceId: string;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly type?: EvidenceType | undefined;
  readonly source?: EvidenceSource | undefined;
  readonly ownerUserId?: string | undefined;
  readonly collectedOn?: string | undefined;
  readonly validUntil?: string | null | undefined;
  readonly externalUrl?: string | null | undefined;
  readonly observation?: string | null | undefined;
}

@Injectable()
export class UpdateEvidenceUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly evidenceRepository: EvidenceRepositoryPort,
    private readonly referenceData: EvidenceReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly scopeEnforcer: OrgScopeEnforcerService,
  ) {}

  async execute(input: UpdateEvidenceInput): Promise<EvidenceRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);
    const current = await this.evidenceRepository.findById(scope, input.evidenceId);
    if (!current) {
      return this.scopeEnforcer.assertExistingRecordAccessible(
        {
          scope,
          actorUserId: input.actorUserId,
          entityType: AuditEntityType.EVIDENCE,
          entityId: input.evidenceId,
          entityLabel: USER_MESSAGES.evidence.entityLabel,
        },
        () => this.evidenceRepository.findOrgUnitIdUnscoped(input.evidenceId),
      );
    }

    assertEvidenceEditable(current.status);

    const changes: { -readonly [K in keyof UpdateEvidenceChanges]: UpdateEvidenceChanges[K] } = {};
    const previousValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (input.title !== undefined && input.title !== current.title) {
      changes.title = input.title;
      previousValues.title = current.title;
      newValues.title = input.title;
    }

    if (input.description !== undefined && input.description !== (current.description ?? null)) {
      changes.description = input.description;
      previousValues.description = current.description ?? null;
      newValues.description = input.description;
    }

    if (input.type !== undefined && input.type !== current.type) {
      changes.type = input.type;
      previousValues.type = current.type;
      newValues.type = input.type;
    }

    if (input.source !== undefined && input.source !== current.source) {
      changes.source = input.source;
      previousValues.source = current.source;
      newValues.source = input.source;
    }

    if (input.ownerUserId !== undefined && input.ownerUserId !== current.owner.id) {
      const owner = await this.referenceData.findUser(input.ownerUserId);
      if (!owner?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.evidence.ownerNotFound, [
          { field: 'ownerUserId', message: USER_MESSAGES.evidence.ownerNotFound },
        ]);
      }
      changes.ownerUserId = input.ownerUserId;
      previousValues.ownerUserId = current.owner.id;
      newValues.ownerUserId = input.ownerUserId;
    }

    let collectedOn = current.collectedOn;
    if (input.collectedOn !== undefined) {
      const parsed = parseIsoDate(input.collectedOn);
      if (parsed.getTime() !== current.collectedOn.getTime()) {
        changes.collectedOn = parsed;
        previousValues.collectedOn = current.collectedOn;
        newValues.collectedOn = parsed;
      }
      collectedOn = parsed;
    }

    let validUntil = current.validUntil ?? null;
    if (input.validUntil !== undefined) {
      const parsed = input.validUntil === null ? null : parseIsoDate(input.validUntil);
      const currentValidUntil = current.validUntil ?? null;
      if (
        (parsed === null) !== (currentValidUntil === null) ||
        (parsed !== null &&
          currentValidUntil !== null &&
          parsed.getTime() !== currentValidUntil.getTime())
      ) {
        changes.validUntil = parsed;
        previousValues.validUntil = currentValidUntil;
        newValues.validUntil = parsed;
      }
      validUntil = parsed;
    }
    if (validUntil !== null) {
      assertValidUntilNotBeforeCollectedOn(collectedOn, validUntil);
    }

    let externalUrl = current.externalUrl ?? null;
    if (input.externalUrl !== undefined && input.externalUrl !== (current.externalUrl ?? null)) {
      changes.externalUrl = input.externalUrl;
      previousValues.externalUrl = current.externalUrl ?? null;
      newValues.externalUrl = input.externalUrl;
      externalUrl = input.externalUrl;
    }

    let observation = current.observation ?? null;
    if (input.observation !== undefined && input.observation !== (current.observation ?? null)) {
      changes.observation = input.observation;
      previousValues.observation = current.observation ?? null;
      newValues.observation = input.observation;
      observation = input.observation;
    }

    if ('externalUrl' in changes || 'observation' in changes) {
      assertEvidenceHasSubstance({ externalUrl, observation });
    }

    if (Object.keys(changes).length === 0) {
      return current;
    }

    return this.transactionRunner.run(async () => {
      const updated = await this.evidenceRepository.update(scope, input.evidenceId, changes);
      if (!updated) {
        throw new NotFoundDomainError(USER_MESSAGES.evidence.entityLabel, input.evidenceId);
      }

      await this.auditRecorder.record({
        action: 'evidence.updated',
        entityType: AuditEntityType.EVIDENCE,
        entityId: input.evidenceId,
        actorLabel: actor.fullName,
        previousValues,
        newValues,
        organizationalUnitId: current.orgUnit.id,
      });

      return updated;
    });
  }
}
