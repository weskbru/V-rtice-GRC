/**
 * T124 — port for the append-only `RiskAssessment` table. `CreateAssessment
 * UseCase` and the assessment-history read path depend on this abstract
 * class, never on `PrismaService` directly (ADR-011).
 *
 * There is no update method here — matching FR-065/data-model.md §9's
 * "no update path exists": every mutation is either `create` (a new row)
 * or, on `RiskRepositoryPort`, `applyAssessmentResult` (repointing the
 * PARENT risk's denormalized pointer/levels, never the assessment row
 * itself).
 *
 * `modules/risk/infrastructure/risk-assessment.repository.ts` is the only
 * implementation, wired in `risk.module.ts`.
 */
import type { RiskLevelValue } from '../methodology.schema';
import type { UserRefRecord } from './risk-repository.port';

export interface AssessmentMethodologyVersionRef {
  readonly id: string;
  readonly versionNumber: number;
}

/** One assessment, exactly as the presentation layer's mapper needs it. */
export interface AssessmentRecord {
  readonly id: string;
  readonly riskId: string;
  readonly methodologyVersion: AssessmentMethodologyVersionRef;
  readonly assessedBy: UserRefRecord;
  readonly assessedOn: Date;
  readonly inherentProbability: number;
  readonly inherentImpact: number;
  readonly inherentScore: number;
  readonly inherentLevel: RiskLevelValue;
  readonly residualProbability: number;
  readonly residualImpact: number;
  readonly residualScore: number;
  readonly residualLevel: RiskLevelValue;
  readonly controlsConsidered: readonly string[];
  readonly rationale: string | null;
  readonly previousAssessmentId: string | null;
}

export interface CreateAssessmentRecordInput {
  readonly riskId: string;
  readonly methodologyVersionId: string;
  readonly assessedByUserId: string;
  readonly assessedOn: Date;
  readonly inherentProbability: number;
  readonly inherentImpact: number;
  readonly inherentScore: number;
  readonly inherentLevel: RiskLevelValue;
  readonly residualProbability: number;
  readonly residualImpact: number;
  readonly residualScore: number;
  readonly residualLevel: RiskLevelValue;
  readonly controlsConsidered: readonly string[];
  readonly rationale: string | null;
  readonly previousAssessmentId: string | null;
}

export interface AssessmentPage {
  readonly items: readonly AssessmentRecord[];
  readonly total: number;
}

export abstract class RiskAssessmentRepositoryPort {
  /** Pure insert — no scope predicate here: the caller (`CreateAssessment
   * UseCase`) has already resolved and scope-checked the parent `Risk` via
   * `RiskRepositoryPort.findById` before this is ever called, so a second,
   * independent scope predicate on a table with no `orgUnitId` column of
   * its own would need a join to re-derive the same answer FOR FREE. */
  abstract create(input: CreateAssessmentRecordInput): Promise<AssessmentRecord>;

  /** Single-row lookup by id, with no scope predicate — same "the caller
   * already authorized the parent risk" reasoning as `create`/`listByRisk`.
   * Used by `AssessmentController` (T125) ONLY to resolve the one item at a
   * page boundary whose `previousAssessmentId` fell outside the current
   * page's own rows — never a per-row lookup for the whole page (that would
   * be exactly the N+1 pattern CLAUDE.md warns against). */
  abstract findById(id: string): Promise<AssessmentRecord | undefined>;

  /**
   * Every assessment for `riskId`, newest first (`assessedOn DESC`, then
   * `id DESC` as a UUIDv7 insertion-order tiebreak — see the Prisma model's
   * own comment for why no separate `createdAt` column is needed for this).
   * Access to `riskId` itself must already have been authorized by the
   * caller (see `create`'s doc comment — identical reasoning).
   */
  abstract listByRisk(riskId: string, page: number, pageSize: number): Promise<AssessmentPage>;
}
