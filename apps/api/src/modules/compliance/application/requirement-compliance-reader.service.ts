/**
 * T027/T049/004-compliance-management — gathers the real inputs
 * `calculateRequirementComplianceState` (research.md D-8) needs, and
 * populates `Requirement.applicability`, for every use case that serves a
 * `Requirement` representation. Also owns the observation-time audit
 * comparison (research.md D-11, User Story 3, T049-T052): every
 * computation performed here — single or batched — is immediately
 * compared against `RequirementComplianceAuditMark` and, when it differs,
 * recorded as a `REQUIREMENT_COMPLIANCE_STATE` audit event. This is the
 * single point every future caller of `deriveForOne`/`deriveForMany`
 * inherits the D-11 guarantee from automatically, with no call site of
 * its own needing to know the mechanism exists.
 *
 * ## Why the audit side effect lives HERE, not in each calling use case
 *
 * D-11 requires the comparison to run "a cada leitura que o expõe... e
 * como efeito colateral de toda escrita [...] que pode afetar" —
 * `GetRequirementUseCase`, `ListRequirementsUseCase`, the
 * compliance-summary use case, AND every User Story 2/3 write that
 * touches a requirement's compliance inputs (link/unlink, declare/revoke,
 * migrate) all call `deriveForOne`/`deriveForMany` already, to serve their
 * own response or to trigger this exact side effect. Embedding it in the
 * one shared gathering step means none of those callers needs its own
 * copy of the watermark-comparison logic — the same reasoning D-8's
 * single calculator exists for, applied one layer up.
 *
 * ## Best-effort, never part of the read/write contract (D-11's own text)
 *
 * The audit-mark write (and the event it may emit) runs inside its own
 * `transactionRunner.run(...)` scope, wrapped in try/catch: a failure here
 * is logged and swallowed, never surfaced as a failure of the
 * read/write the caller actually asked for — "a resposta nunca depende do
 * resultado dessa escrita" (D-11). This also means a `GET` that computes
 * `complianceState` keeps returning it correctly even if the bookkeeping
 * write fails for any reason (e.g. a losing concurrent writer, or a
 * transient DB error) — bookkeeping best-effort, not part of the read.
 *
 * ## Real batching for `deriveForMany` (research.md D-10)
 *
 * Unlike an earlier draft of this file (which called `deriveForOne` once
 * per row), the batch path below resolves applicability, linked-control
 * ids, control directory entries and control effectiveness each in ONE
 * round trip for the whole set of rows — the "uma leitura em lote" D-10
 * requires so a 500-requirement compliance summary (SC-008) stays well
 * inside its 2-second budget.
 */
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

  /** Derives `{ applicability, complianceState }` for a single
   * requirement. `referenceDate` mirrors `ControlEffectivenessService`'s
   * own discipline of never reading the clock inside a derived-state
   * rule — one "now" per request, supplied by the caller. */
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

  /** Batch variant for a listing or a whole-version aggregate (research.md
   * D-10) — one round trip per input type for the whole set of `rows`,
   * never one per row. */
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

  /** Resolves `{ isActive, effectiveness }` for every currently-linked
   * control of every id in `requirementIds`, in three round trips total
   * regardless of how many requirements are given: one for the links
   * themselves, one batched `ControlDirectoryPort.findManyById`, one
   * batched `ControlEffectivenessPort.getEffectivenessBatch` (research.md
   * D-9/D-10). */
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

  /** research.md D-11 — the single-requirement observation comparison.
   * Best-effort: any failure is logged and swallowed (see file header). */
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

  /** Batched counterpart of `auditObservation`, for `deriveForMany`. */
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
