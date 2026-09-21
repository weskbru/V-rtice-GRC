/**
 * 007-implementation-remediation, Frente A, D-1/D-2 (research.md) — port for
 * the risk-owned `RiskTreatmentAction` LINK table (data-model.md §1-§2).
 * `Action` (`grc/action`) is now the SOLE authority for title, description,
 * responsible, due date, status and completion of a risk treatment action —
 * this port only manages the link row itself (`riskId`/`treatmentDecisionId`/
 * `actionId`). The create/update use cases (`application/treatment-actions/**`)
 * depend on this abstract class, never on `PrismaService` directly
 * (ADR-011).
 *
 * `modules/risk/infrastructure/risk-treatment-action.repository.ts` is the
 * only implementation, wired in `risk.module.ts`.
 */
export interface TreatmentActionLinkRecord {
  readonly id: string;
  readonly riskId: string;
  readonly treatmentDecisionId: string | null;
  readonly actionId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTreatmentActionLinkInput {
  readonly riskId: string;
  readonly treatmentDecisionId: string | null;
  /** The shared `Action`'s id, already created (in the SAME transaction) by
   * the time this is called — see `create-treatment-action.usecase.ts`'s
   * own header for the write order (D-1). */
  readonly actionId: string;
}

export abstract class RiskTreatmentActionRepositoryPort {
  /** Pure insert of the link row — no scope predicate: the caller has
   * already resolved and scope-checked the parent `Risk` before this is
   * ever called (same reasoning as `RiskAssessmentRepositoryPort.create`). */
  abstract createLink(input: CreateTreatmentActionLinkInput): Promise<TreatmentActionLinkRecord>;

  /** The link row for a given `riskId`/`actionId` pair, if one exists —
   * `undefined` for an `Action` created directly through `POST /actions`
   * (D-2), or a mismatched pair. */
  abstract findLink(
    riskId: string,
    actionId: string,
  ): Promise<TreatmentActionLinkRecord | undefined>;

  /** Batch lookup for a listing (`RiskTreatmentActionQueryService.listByRisk`)
   * — one query for the whole page, never one per row (CLAUDE.md's N+1
   * pitfall). Keys absent from the result have no link row (D-2). */
  abstract findTreatmentDecisionIdsByActionIds(
    actionIds: readonly string[],
  ): Promise<ReadonlyMap<string, string | null>>;

  /** Sets `treatmentDecisionId` on the link row for `actionId` — creating
   * the link row first if none exists yet (an `Action` originally created
   * outside the risk screen that a caller now associates with a treatment
   * decision — D-2). */
  abstract upsertTreatmentDecisionLink(
    riskId: string,
    actionId: string,
    treatmentDecisionId: string | null,
  ): Promise<TreatmentActionLinkRecord>;

  /**
   * `contracts/risks.openapi.yaml`'s `RiskTreatmentDecision.deadlineOverdue`
   * (FR-075: "the deadline has passed WITH outstanding actions") needs to
   * know, for a page of decisions, which ones have at least one non-terminal
   * action referencing them via `treatmentDecisionId`. Returns the SUBSET of
   * `decisionIds` that do — one query for the whole page, never one query
   * per decision row (CLAUDE.md's N+1 pitfall). Joins to `actions.status`
   * for the "non-terminal" half, since that is where status now lives.
   */
  abstract findDecisionIdsWithOutstandingActions(
    decisionIds: readonly string[],
  ): Promise<ReadonlySet<string>>;
}
