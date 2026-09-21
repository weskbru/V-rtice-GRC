/**
 * T139 — port for the append-only `RiskTreatmentDecision` table
 * (data-model.md §10, FR-071 to FR-073). `RecordTreatmentUseCase` and the
 * treatment-decision history read path depend on this abstract class, never
 * on `PrismaService` directly (ADR-011).
 *
 * There is no generic `update` here — `supersede` is the ONLY mutation this
 * port exposes, matching the migration's database-enforced guarantee
 * (`risk_treatment_decisions_append_only` trigger,
 * `20260905160100_risk_treatment_and_relationships_baseline`) that it is the
 * only mutation the table itself will accept.
 *
 * `modules/risk/infrastructure/risk-treatment-decision.repository.ts` is the
 * only implementation, wired in `risk.module.ts`.
 */
import type { UserRefRecord } from './risk-repository.port';
import type { TreatmentStrategy } from '@prisma/client';

/** One treatment decision, exactly as the presentation layer's mapper
 * needs it. `supersededAt` is the only mutable field this record can ever
 * reflect (FR-073) — everything else is fixed at creation. */
export interface TreatmentDecisionRecord {
  readonly id: string;
  readonly riskId: string;
  readonly strategy: TreatmentStrategy;
  readonly description: string;
  readonly deadline: Date | null;
  readonly decidedBy: UserRefRecord;
  readonly decidedAt: Date;
  readonly supersededAt: Date | null;
}

export interface CreateTreatmentDecisionInput {
  readonly riskId: string;
  readonly strategy: TreatmentStrategy;
  readonly description: string;
  readonly deadline: Date | null;
  readonly decidedByUserId: string;
}

export interface TreatmentDecisionPage {
  readonly items: readonly TreatmentDecisionRecord[];
  readonly total: number;
}

export abstract class RiskTreatmentDecisionRepositoryPort {
  /** Pure insert — no scope predicate: the caller (`RecordTreatmentUseCase`)
   * has already resolved and scope-checked the parent `Risk` via
   * `RiskRepositoryPort.findById` before this is ever called (same
   * reasoning as `RiskAssessmentRepositoryPort.create`'s own doc comment). */
  abstract create(input: CreateTreatmentDecisionInput): Promise<TreatmentDecisionRecord>;

  /**
   * FR-073 — stamps `supersededAt`/`supersededById` on the PREVIOUS current
   * decision. This is the ONLY mutation this port (or the underlying table
   * — see the migration's `risk_treatment_decisions_append_only` trigger)
   * ever performs; every other column of the row is left untouched, which
   * is exactly what T133's integration test proves byte-for-byte.
   */
  abstract supersede(id: string, supersededById: string, supersededAt: Date): Promise<void>;

  /** The risk's current (non-superseded) decision, or `undefined` if none
   * has ever been recorded. Used by `RecordTreatmentUseCase` to find what
   * to supersede, and by the risk detail read path for `currentTreatment`. */
  abstract findCurrentByRisk(riskId: string): Promise<TreatmentDecisionRecord | undefined>;

  /** Single-row lookup by id, regardless of risk or supersession state —
   * used by `CreateTreatmentActionUseCase` to validate an optional
   * `treatmentDecisionId` belongs to the same risk before an action is
   * created against it. */
  abstract findById(id: string): Promise<TreatmentDecisionRecord | undefined>;

  /** Every decision for `riskId`, newest first (`decidedAt DESC`, then `id
   * DESC` as a UUIDv7 insertion-order tiebreak), INCLUDING superseded ones
   * (`contracts/risks.openapi.yaml`'s `listRiskTreatmentDecisions`:
   * "Returns every decision ... including superseded ones"). Access to
   * `riskId` itself must already have been authorized by the caller. */
  abstract listByRisk(
    riskId: string,
    page: number,
    pageSize: number,
  ): Promise<TreatmentDecisionPage>;
}
