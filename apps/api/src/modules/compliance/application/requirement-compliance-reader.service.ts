import { Injectable, Logger } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../core/audit/application/audit-recorder.service';
import { ControlDirectoryPort } from '../../../shared/grc-ports/control-directory.port';
import { ControlEffectivenessPort } from '../../../shared/grc-ports/control-effectiveness.port';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { registerComplianceAuditAllowlists } from '../domain/compliance-audit-allowlist';
import { RequirementComplianceAuditMarkRepositoryPort } from '../domain/ports/requirement-compliance-audit-mark-repository.port';
import { RequirementRepositoryPort } from '../domain/ports/requirement-repository.port';
import { calculateRequirementComplianceState } from '../domain/requirement-compliance.service';

import type {
  RequirementApplicabilityRef,
  RequirementRow,
} from '../domain/ports/requirement-repository.port';
import type { LinkedControlComplianceInput } from '../domain/requirement-compliance.service';
import type { RequirementComplianceState } from '@prisma/client';

export interface RequirementDerivedFields {
  readonly applicability: RequirementApplicabilityRef | undefined;
  readonly complianceState: RequirementComplianceState;
}

@Injectable()
export class RequirementComplianceReaderService {
  private readonly logger = new Logger(RequirementComplianceReaderService.name);

  constructor(
    private readonly requirementRepository: RequirementRepositoryPort,
    private readonly controlDirectory: ControlDirectoryPort,
    private readonly controlEffectiveness: ControlEffectivenessPort,
    private readonly auditMarkRepository: RequirementComplianceAuditMarkRepositoryPort,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditRecorder,
  ) {
    registerComplianceAuditAllowlists();
  }

  async deriveForOne(
    requirementId: string,
    referenceDate: Date,
  ): Promise<RequirementDerivedFields> {
    const [applicability, linkedControls] = await Promise.all([
      this.requirementRepository.findActiveApplicability(requirementId),
      this.resolveLinkedControls([requirementId], referenceDate).then(
        (byRequirement) => byRequirement.get(requirementId) ?? [],
      ),
    ]);

    const complianceState = calculateRequirementComplianceState(
      applicability ? 'NOT_APPLICABLE' : 'APPLICABLE',
      linkedControls,
    );

    await this.auditObservation(requirementId, complianceState, referenceDate);

    return { applicability, complianceState };
  }

  async deriveForMany(
    rows: readonly RequirementRow[],
    referenceDate: Date,
  ): Promise<ReadonlyMap<string, RequirementDerivedFields>> {
    if (rows.length === 0) {
      return new Map();
    }

    const requirementIds = rows.map((row) => row.id);
    const [applicabilityById, linkedControlsById] = await Promise.all([
      this.requirementRepository.findActiveApplicabilityMany(requirementIds),
      this.resolveLinkedControls(requirementIds, referenceDate),
    ]);

    const results = new Map<string, RequirementDerivedFields>();
    for (const row of rows) {
      const applicability = applicabilityById.get(row.id);
      const complianceState = calculateRequirementComplianceState(
        applicability ? 'NOT_APPLICABLE' : 'APPLICABLE',
        linkedControlsById.get(row.id) ?? [],
      );
      results.set(row.id, { applicability, complianceState });
    }

    await this.auditObservations(results, referenceDate);

    return results;
  }

  private async resolveLinkedControls(
    requirementIds: readonly string[],
    referenceDate: Date,
  ): Promise<ReadonlyMap<string, readonly LinkedControlComplianceInput[]>> {
    let controlIdsByRequirement: ReadonlyMap<string, readonly string[]>;
    if (requirementIds.length === 1) {
      const onlyId = requirementIds[0]!;
      const controlIds = await this.requirementRepository.findActiveLinkedControlIds(onlyId);
      controlIdsByRequirement = new Map([[onlyId, controlIds]]);
    } else {
      controlIdsByRequirement =
        await this.requirementRepository.findActiveLinkedControlIdsMany(requirementIds);
    }

    const allControlIds = Array.from(new Set(Array.from(controlIdsByRequirement.values()).flat()));
    if (allControlIds.length === 0) {
      return new Map(requirementIds.map((id) => [id, []]));
    }

    const [directoryEntries, effectivenessByControlId] = await Promise.all([
      this.controlDirectory.findManyById(allControlIds),
      this.controlEffectiveness.getEffectivenessBatch(allControlIds, referenceDate),
    ]);
    const directoryById = new Map(directoryEntries.map((entry) => [entry.id, entry]));

    const result = new Map<string, readonly LinkedControlComplianceInput[]>();
    for (const requirementId of requirementIds) {
      const controlIds = controlIdsByRequirement.get(requirementId) ?? [];
      result.set(
        requirementId,
        controlIds.map((controlId) => ({
          isActive: directoryById.get(controlId)?.isActive ?? false,
          effectiveness: effectivenessByControlId.get(controlId) ?? 'NOT_ASSESSED',
        })),
      );
    }
    return result;
  }

  private async auditObservation(
    requirementId: string,
    state: RequirementComplianceState,
    observedAt: Date,
  ): Promise<void> {
    try {
      await this.transactionRunner.run(async () => {
        const observation = await this.auditMarkRepository.recordObservation(
          requirementId,
          state,
          observedAt,
        );
        if (observation.outcome === 'CHANGED') {
          await this.recordComplianceStateEvent(
            requirementId,
            observation.previousState,
            state,
            observedAt,
          );
        }
      });
    } catch (error) {
      this.logger.warn(
        `failed to record compliance-state observation for requirement ${requirementId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async auditObservations(
    results: ReadonlyMap<string, RequirementDerivedFields>,
    observedAt: Date,
  ): Promise<void> {
    const entries = Array.from(results.entries()).map(([requirementId, fields]) => ({
      requirementId,
      state: fields.complianceState,
    }));
    if (entries.length === 0) {
      return;
    }

    try {
      await this.transactionRunner.run(async () => {
        const observations = await this.auditMarkRepository.recordObservations(entries, observedAt);
        for (const [requirementId, observation] of observations) {
          if (observation.outcome === 'CHANGED') {
            const state = results.get(requirementId)?.complianceState;
            if (state !== undefined) {
              await this.recordComplianceStateEvent(
                requirementId,
                observation.previousState,
                state,
                observedAt,
              );
            }
          }
        }
      });
    } catch (error) {
      this.logger.warn(
        'failed to record batched compliance-state observations',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async recordComplianceStateEvent(
    requirementId: string,
    previousState: RequirementComplianceState,
    newState: RequirementComplianceState,
    observedAt: Date,
  ): Promise<void> {
    await this.auditRecorder.record({
      action: 'compliance.requirement_compliance_state_observed',
      entityType: AuditEntityType.REQUIREMENT_COMPLIANCE_STATE,
      entityId: requirementId,
      actorLabel: USER_MESSAGES.compliance.complianceStateObserverActorLabel,
      newValues: { requirementId, previousState, newState, observedAt },
    });
  }
}
