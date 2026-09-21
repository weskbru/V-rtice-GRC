/**
 * T032/002-shared-grc-foundation, US1 — `CreateEvidenceUseCase` (FR-001 to
 * FR-006, FR-010, ADR-005). Mirrors
 * `modules/risk/application/create-risk.usecase.ts`'s shape closely — see
 * that file's header for the transaction-boundary reasoning this one does
 * not repeat.
 *
 * ## Order of checks
 *
 * 1. `orgUnitId` must exist, be active, and lie within the caller's
 *    authorized scope (FR-003/FR-031) — `422`, not `404` (no existing
 *    record's existence could be disclosed at creation time). Assurance
 *    fix (confirmed breach): a nonexistent `orgUnitId` and one that exists
 *    but is outside the caller's scope used to throw two DIFFERENT
 *    messages, letting a scope-limited caller probe for the existence of
 *    an organizational unit — exactly what this endpoint's own contract
 *    promises never happens ("Answered as not-found so the response
 *    cannot confirm existence", `grc-foundation.openapi.yaml`). Both
 *    branches now throw the identical `orgUnitNotFound` message. This is
 *    NOT the same convention `CreateRiskUseCase` uses (it deliberately
 *    keeps the two messages distinct, per its OWN contract, which makes no
 *    such promise) — the two are allowed to differ because they answer to
 *    different contracts, not because one of them is inconsistent.
 * 2. `ownerUserId` must exist and be active (FR-004 referential integrity).
 * 3. Invariant E1 — at least one of `externalUrl`/`observation` (FR-002,
 *    revised; see `evidence.entity.ts`'s own comment for why `fileId` does
 *    not participate).
 * 4. Invariant E2 — `validUntil` not before `collectedOn`.
 *
 * ## Code year
 *
 * `EVD-{year}-{sequence}`'s year is the creation year (server clock, UTC),
 * not `collectedOn`'s year — identical reasoning to
 * `CreateRiskUseCase`'s own interpretive decision (FR-005 deliberately
 * keeps `collectedOn` a business-supplied, possibly backdated field; tying
 * the immutable code to it would let a caller choose which year's sequence
 * a code lands in).
 */
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
    // Assurance fix — see this file's own header: existence and scope
    // failures are indistinguishable to the caller, both in status (422)
    // and in message (`orgUnitNotFound`), never `orgUnitOutOfScope`.
    const orgUnit = await this.referenceData.findOrgUnit(orgUnitId);
    if (!orgUnit?.isActive || !isOrgUnitWithinScope(scope, orgUnitId)) {
      throw new ValidationDomainError(USER_MESSAGES.evidence.orgUnitNotFound, [
        { field: 'orgUnitId', message: USER_MESSAGES.evidence.orgUnitNotFound },
      ]);
    }
  }
}
