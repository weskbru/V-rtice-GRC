/**
 * 007-implementation-remediation, Frente A, D-1 a D-5 —
 * `UpdateTreatmentActionUseCase`. `PATCH /risks/{riskId}/treatment-actions/{actionId}`
 * (`contracts/risks.openapi.yaml`'s `updateRiskTreatmentAction`, D-2:
 * `actionId` in the path is now `Action.id`).
 *
 * `Action` (`grc/action`) is the SOLE authority now (D-1). Field edits and
 * status transitions are applied by calling `grc/action`'s OWN use cases
 * directly — `UpdateActionUseCase` for
 * title/description/responsibleUserId/dueOn, `TransitionActionUseCase` for
 * `status` — never a mirror. `TransitionActionUseCase` enforces the SAME
 * legality table and reopen-reason invariant as `POST
 * /actions/{id}/transitions` (D-3): the 11 pairs the risk route used to
 * accept and `Action`'s own endpoint would reject now return `422` here
 * too, on the SAME table, not a second one.
 *
 * Authorization stays origin-side (D-4): this route keeps `risk:treat`
 * (checked by `@RequirePermission` at the controller); `UpdateActionUseCase`/
 * `TransitionActionUseCase` each re-derive the origin's LIVE organizational
 * scope via `assertActionOriginInScope` — that re-derivation IS the access
 * decision, not an extra check layered on top.
 *
 * Every operation ALSO verifies the path's `:riskId` genuinely is this
 * action's origin (not just "actor has scope over SOME origin") — without
 * this, `PATCH /risks/A/treatment-actions/{action-of-risk-B}` would
 * succeed for an actor scoped to both, silently ignoring the URL's own
 * claim. A mismatch is indistinguishable from "not found" (same shape the
 * retired `findById(riskId, actionId)` already gave).
 */
import { Injectable } from '@nestjs/common';
import { AuditEntityType } from '@prisma/client';

import { AuditRecorder } from '../../../../core/audit/application/audit-recorder.service';
import { ScopeResolverService } from '../../../../core/organizations/application/scope-resolver.service';
import { TransitionActionUseCase } from '../../../../grc/action/application/transition-action.usecase';
import { UpdateActionUseCase } from '../../../../grc/action/application/update-action.usecase';
import { ActionRepositoryPort } from '../../../../grc/action/domain/ports/action-repository.port';
import {
  NotFoundDomainError,
  OptimisticLockDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../../shared/persistence/transaction-runner.port';
import { RiskReferenceDataPort } from '../../domain/ports/risk-reference-data.port';
import { RiskRepositoryPort } from '../../domain/ports/risk-repository.port';
import { RiskTreatmentActionRepositoryPort } from '../../domain/ports/risk-treatment-action-repository.port';
import { RiskTreatmentDecisionRepositoryPort } from '../../domain/ports/risk-treatment-decision-repository.port';
import { assertBusinessContentEditable } from '../../domain/risk.entity';

import type { ActionRecord } from '../../../../grc/action/domain/ports/action-repository.port';
import type { RiskRecord } from '../../domain/ports/risk-repository.port';
import type { ActionStatus } from '@prisma/client';

const RISK_ENTITY_LABEL = 'Risco';

export interface UpdateTreatmentActionInput {
  readonly actorUserId: string;
  readonly riskId: string;
  readonly actionId: string;
  readonly expectedVersion: number;
  readonly title?: string | undefined;
  readonly description?: string | null | undefined;
  readonly responsibleUserId?: string | undefined;
  readonly dueOn?: string | undefined;
  readonly status?: ActionStatus | undefined;
  /** D-3 — required when `status: 'OPEN'` reopens a `COMPLETED` action;
   * `TransitionActionUseCase`/`assertReopenReasonProvided` enforce this,
   * never re-validated here (single source of the rule). */
  readonly reopenReason?: string | undefined;
  /** D-1/D-2 — sets or clears the link row's own `treatmentDecisionId`.
   * Upserts the link row when the action has none yet (an `Action`
   * originally created through `POST /actions`, now being associated with
   * a treatment decision from the risk screen — the case D-2 names
   * explicitly). `undefined` = leave unchanged; `null` = clear it. */
  readonly treatmentDecisionId?: string | null | undefined;
}

export interface UpdateTreatmentActionResult {
  readonly action: ActionRecord;
  readonly treatmentDecisionId: string | null;
  readonly risk: RiskRecord;
}

@Injectable()
export class UpdateTreatmentActionUseCase {
  constructor(
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly riskRepository: RiskRepositoryPort,
    private readonly treatmentActionRepository: RiskTreatmentActionRepositoryPort,
    private readonly treatmentDecisionRepository: RiskTreatmentDecisionRepositoryPort,
    private readonly actionRepository: ActionRepositoryPort,
    private readonly referenceData: RiskReferenceDataPort,
    private readonly scopeResolver: ScopeResolverService,
    private readonly auditRecorder: AuditRecorder,
    private readonly updateActionUseCase: UpdateActionUseCase,
    private readonly transitionActionUseCase: TransitionActionUseCase,
  ) {}

  async execute(input: UpdateTreatmentActionInput): Promise<UpdateTreatmentActionResult> {
    const actor = await this.referenceData.findUser(input.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const scope = await this.scopeResolver.resolveScope(input.actorUserId);

    const currentRisk = await this.riskRepository.findById(scope, input.riskId);
    if (!currentRisk) {
      throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
    }

    assertBusinessContentEditable(currentRisk.status);

    // Unscoped read purely to confirm the URL's :riskId is genuinely this
    // action's origin — the actual access decision happens inside
    // `UpdateActionUseCase`/`TransitionActionUseCase` below, via the
    // origin's LIVE scope (D-4). A mismatch is indistinguishable from "not
    // found" — never a refusal that confirms a DIFFERENT risk's action
    // exists.
    const existingAction = await this.actionRepository.findByIdUnscoped(input.actionId);
    if (
      existingAction?.originType !== 'RISK_TREATMENT' ||
      existingAction.originId !== input.riskId
    ) {
      throw new NotFoundDomainError(USER_MESSAGES.action.entityLabel, input.actionId);
    }

    if (input.treatmentDecisionId) {
      const decision = await this.treatmentDecisionRepository.findById(input.treatmentDecisionId);
      if (decision?.riskId !== input.riskId) {
        throw new ValidationDomainError(USER_MESSAGES.risk.treatment.decisionNotFound, [
          { field: 'treatmentDecisionId', message: USER_MESSAGES.risk.treatment.decisionNotFound },
        ]);
      }
    }

    return this.transactionRunner.run(async () => {
      let updated: ActionRecord = existingAction;

      const fieldChanges = {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.responsibleUserId !== undefined
          ? { responsibleUserId: input.responsibleUserId }
          : {}),
        ...(input.dueOn !== undefined ? { dueOn: input.dueOn } : {}),
      };
      if (Object.keys(fieldChanges).length > 0) {
        updated = await this.updateActionUseCase.execute({
          actorUserId: input.actorUserId,
          actionId: input.actionId,
          ...fieldChanges,
        });
      }

      // D-3 — the SAME legality table and reopen-reason invariant as
      // `POST /actions/{id}/transitions`, on this route too. No mirror, no
      // second, more permissive table.
      if (input.status !== undefined) {
        updated = await this.transitionActionUseCase.execute({
          actorUserId: input.actorUserId,
          actionId: input.actionId,
          to: input.status,
          reason: input.reopenReason,
        });
      }

      const result = await this.riskRepository.touchVersion(
        scope,
        input.riskId,
        input.expectedVersion,
      );

      if (result.outcome === 'NOT_FOUND') {
        throw new NotFoundDomainError(RISK_ENTITY_LABEL, input.riskId);
      }
      if (result.outcome === 'VERSION_CONFLICT') {
        throw new OptimisticLockDomainError(
          RISK_ENTITY_LABEL,
          input.riskId,
          input.expectedVersion,
          result.currentVersion,
          result.currentStatus,
        );
      }

      // D-5 — for field/status changes, ONLY the `action.*` event(s) that
      // `UpdateActionUseCase`/`TransitionActionUseCase` already fired
      // above. The duplicate `risk.treatment_action_status_changed`/
      // `_updated` pair that used to fire alongside the mirror is RETIRED
      // for those two operations.
      let link = await this.treatmentActionRepository.findLink(input.riskId, input.actionId);

      if (input.treatmentDecisionId !== undefined) {
        const previousTreatmentDecisionId = link?.treatmentDecisionId ?? null;
        link = await this.treatmentActionRepository.upsertTreatmentDecisionLink(
          input.riskId,
          input.actionId,
          input.treatmentDecisionId,
        );

        // D-5 — the LINK ROW's own event, `entityId` is the link row's OWN
        // id (never the action's — coordinator review, 2026-09-11, same
        // reasoning as the create path). Fired whether this upsert CREATED
        // the link row (an action that came in through `POST /actions`,
        // now first associated with a treatment decision from the risk
        // screen) or only UPDATED an existing one's
        // `treatmentDecisionId` — same event shape either way, because
        // both are "this link row's treatmentDecisionId is now X", the one
        // fact the link row itself carries.
        if (link.treatmentDecisionId !== previousTreatmentDecisionId) {
          await this.auditRecorder.record({
            action: 'risk.treatment_action_updated',
            entityType: AuditEntityType.RISK_TREATMENT_ACTION,
            entityId: link.id,
            actorLabel: actor.fullName,
            previousValues: { treatmentDecisionId: previousTreatmentDecisionId },
            newValues: {
              riskId: input.riskId,
              treatmentDecisionId: link.treatmentDecisionId,
              actionId: input.actionId,
            },
            organizationalUnitId: result.record.orgUnit.id,
          });
        }
      }

      return {
        action: updated,
        treatmentDecisionId: link?.treatmentDecisionId ?? null,
        risk: result.record,
      };
    });
  }
}
