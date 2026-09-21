/**
 * T036/T042/004-compliance-management, User Story 2 —
 * `ExecuteMappingMigrationUseCase`. `POST
 * /frameworks/{frameworkId}/versions/{versionId}/mapping-migrations`
 * (`executeMappingMigration` operation, FR-012/FR-013/FR-014, research.md
 * D-6). The human decides every correspondence; this use case only
 * classifies (`classifyMappingMigrationTarget`, pure, D-6) and copies —
 * see that function's own doc comment for why no heuristic ever runs
 * here.
 *
 * ## Re-runnable by construction (research.md D-6)
 *
 * Every execution classifies EVERY requirement of the target version
 * fresh, against the CURRENT state of `RequirementControlLink` — a
 * requirement already `COPIED` or `SKIPPED_ALREADY_MAPPED` (by a prior
 * run or a manual link) now has an active link of its own, so
 * `classifyMappingMigrationTarget` returns `SKIPPED_ALREADY_MAPPED` for it
 * again regardless of whether it also appears in this run's
 * `correspondences` — never re-copied, never overwritten (FR-014).
 *
 * ## One audit event, not one per link (SC-004)
 *
 * `RequirementControlMappingMigrationRepository.create` writes every
 * `COPIED` item's new `RequirementControlLink` rows with no per-link audit
 * call; the ONE `REQUIREMENT_CONTROL_MAPPING_MIGRATION` event below,
 * carrying the outcome counts, is the only audit trace of the whole
 * execution (US2 AS4).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { registerComplianceAuditAllowlists } from '../../domain/compliance-audit-allowlist';
import { ComplianceReferenceDataPort } from '../../domain/ports/compliance-reference-data.port';
import { FrameworkVersionRepositoryPort } from '../../domain/ports/framework-version-repository.port';
import { RequirementControlLinkRepositoryPort } from '../../domain/ports/requirement-control-link-repository.port';
import { RequirementControlMappingMigrationRepositoryPort } from '../../domain/ports/requirement-control-mapping-migration-repository.port';
import { RequirementRepositoryPort } from '../../domain/ports/requirement-repository.port';
import { classifyMappingMigrationTarget } from '../../domain/requirement-control-mapping-migration.entity';
import { RequirementComplianceReaderService } from '../requirement-compliance-reader.service';

import type { ValidationFieldError } from '../../../../shared/errors/domain-error';
import type { CreateMappingMigrationItemInput } from '../../domain/ports/requirement-control-mapping-migration-repository.port';
import type { MappingMigrationDetailRecord } from '../../domain/requirement-control-mapping-migration.entity';

export interface MappingMigrationCorrespondenceInput {
  readonly targetRequirementId: string;
  readonly sourceRequirementIds: readonly string[];
}

export interface ExecuteMappingMigrationInput {
  readonly actorUserId: string;
  readonly frameworkId: string;
  readonly targetVersionId: string;
  readonly sourceFrameworkVersionId: string;
  readonly correspondences: readonly MappingMigrationCorrespondenceInput[];
}

@Injectable()
export class ExecuteMappingMigrationUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly frameworkVersionRepository: FrameworkVersionRepositoryPort,
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly linkRepository: RequirementControlLinkRepositoryPort,
    private readonly migrationRepository: RequirementControlMappingMigrationRepositoryPort,
    private readonly referenceData: ComplianceReferenceDataPort,
    private readonly auditRecorder: AuditRecorder,
    private readonly complianceReader: RequirementComplianceReaderService,
  ) {
    registerComplianceAuditAllowlists();
  }

  async execute(input: ExecuteMappingMigrationInput): Promise<MappingMigrationDetailRecord> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const targetVersion = await this.frameworkVersionRepository.findById(input.targetVersionId);
    if (targetVersion?.framework.id !== input.frameworkId) {
      throw new NotFoundDomainError(
        USER_MESSAGES.compliance.frameworkVersionEntityLabel,
        input.targetVersionId,
      );
    }

    const sourceVersion = await this.frameworkVersionRepository.findById(
      input.sourceFrameworkVersionId,
    );
    if (sourceVersion?.framework.id !== input.frameworkId) {
      throw new ValidationDomainError(
        USER_MESSAGES.compliance.mappingMigration.sourceFrameworkMismatch,
        [
          {
            field: 'sourceFrameworkVersionId',
            message: USER_MESSAGES.compliance.mappingMigration.sourceFrameworkMismatch,
          },
        ],
      );
    }

    const [targetRequirements, sourceRequirements] = await Promise.all([
      this.requirementRepository.findAllByFrameworkVersion(input.targetVersionId),
      this.requirementRepository.findAllByFrameworkVersion(input.sourceFrameworkVersionId),
    ]);
    const validTargetIds = new Set(targetRequirements.map((row) => row.id));
    const validSourceIds = new Set(sourceRequirements.map((row) => row.id));

    const { correspondenceByTarget, errors } = this.validateCorrespondences(
      input.correspondences,
      validTargetIds,
      validSourceIds,
    );
    if (errors.length > 0) {
      throw new ValidationDomainError(
        USER_MESSAGES.compliance.mappingMigration.correspondencesInvalid,
        errors,
      );
    }

    const sourceIdsReferenced = Array.from(
      new Set(input.correspondences.flatMap((entry) => entry.sourceRequirementIds)),
    );
    const activeControlIdsByRequirement =
      await this.linkRepository.findActiveControlIdsByRequirement([
        ...targetRequirements.map((row) => row.id),
        ...sourceIdsReferenced,
      ]);

    const items: CreateMappingMigrationItemInput[] = targetRequirements.map((row) => {
      const hasActiveLink = (activeControlIdsByRequirement.get(row.id)?.length ?? 0) > 0;
      const sourceIds = correspondenceByTarget.get(row.id);
      const outcome = classifyMappingMigrationTarget(hasActiveLink, sourceIds);

      const controlIdsToLink =
        outcome === 'COPIED'
          ? Array.from(
              new Set(
                (sourceIds ?? []).flatMap(
                  (sourceId) => activeControlIdsByRequirement.get(sourceId) ?? [],
                ),
              ),
            )
          : [];

      return {
        targetRequirementId: row.id,
        sourceRequirementIds: sourceIds ?? [],
        outcome,
        controlIdsToLink,
      };
    });

    const executedAt = new Date();
    const detail = await this.transactionRunner.run(async () => {
      const created = await this.migrationRepository.create({
        frameworkId: input.frameworkId,
        sourceFrameworkVersionId: input.sourceFrameworkVersionId,
        targetFrameworkVersionId: input.targetVersionId,
        executedByUserId: input.actorUserId,
        executedAt,
        items,
      });

      await this.auditRecorder.record({
        action: 'compliance.requirement_control_mapping_migrated',
        entityType: AuditEntityType.REQUIREMENT_CONTROL_MAPPING_MIGRATION,
        entityId: created.id,
        actorLabel: actor.fullName,
        newValues: {
          frameworkId: input.frameworkId,
          sourceFrameworkVersionId: input.sourceFrameworkVersionId,
          targetFrameworkVersionId: input.targetVersionId,
          copiedCount: created.copiedCount,
          pendingDecisionCount: created.pendingDecisionCount,
          skippedAlreadyMappedCount: created.skippedAlreadyMappedCount,
        },
      });

      return created;
    });

    // research.md D-11 — only `COPIED` targets actually gained a link, so
    // only those can have a fresh compliance state to audit.
    await Promise.all(
      detail.items
        .filter((item) => item.outcome === 'COPIED')
        .map((item) => this.complianceReader.deriveForOne(item.targetRequirement.id, executedAt)),
    );

    return detail;
  }

  private validateCorrespondences(
    correspondences: readonly MappingMigrationCorrespondenceInput[],
    validTargetIds: ReadonlySet<string>,
    validSourceIds: ReadonlySet<string>,
  ): {
    readonly correspondenceByTarget: ReadonlyMap<string, readonly string[]>;
    readonly errors: ValidationFieldError[];
  } {
    const errors: ValidationFieldError[] = [];
    const correspondenceByTarget = new Map<string, readonly string[]>();

    correspondences.forEach((entry, index) => {
      if (!validTargetIds.has(entry.targetRequirementId)) {
        errors.push({
          field: `correspondences[${String(index)}].targetRequirementId`,
          message: USER_MESSAGES.compliance.mappingMigration.targetNotInTargetVersion,
        });
      } else if (correspondenceByTarget.has(entry.targetRequirementId)) {
        errors.push({
          field: `correspondences[${String(index)}].targetRequirementId`,
          message: USER_MESSAGES.compliance.mappingMigration.targetDuplicated,
        });
      } else {
        correspondenceByTarget.set(entry.targetRequirementId, entry.sourceRequirementIds);
      }

      for (const sourceId of entry.sourceRequirementIds) {
        if (!validSourceIds.has(sourceId)) {
          errors.push({
            field: `correspondences[${String(index)}].sourceRequirementIds`,
            message: USER_MESSAGES.compliance.mappingMigration.sourceNotInSourceVersion,
          });
        }
      }
    });

    return { correspondenceByTarget, errors };
  }
}
