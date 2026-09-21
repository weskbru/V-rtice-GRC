/**
 * T166/US7 — port for the risk History view (ADR-006: "a query over the
 * append-only domain records and the relevant audit entries ... not a
 * stored table"). `GetRiskHistoryUseCase` depends on this abstract class,
 * never on `PrismaService` directly (ADR-011).
 *
 * `RiskHistoryQueryService` (`infrastructure/risk-history.service.ts`) is
 * the only implementation, wired in `risk.module.ts`.
 *
 * `RiskHistoryEntryType` deliberately covers only the five categories
 * ADR-006 and this task name — `ASSESSMENT`, `TREATMENT_DECISION`,
 * `LIFECYCLE_TRANSITION`, `APPROVAL`, `OWNERSHIP_CHANGE` — a subset of
 * `contracts/risks.openapi.yaml`'s `RiskHistoryEntryType` enum (which also
 * reserves `LEVEL_CHANGE`, `TREATMENT_ACTION`, `CONTROL_LINK`,
 * `FIELD_CHANGE` for future work this task does not implement — see the
 * implementation report for why: CLAUDE.md §2 forbids building
 * functionality beyond what is specified/approved for THIS task, and the
 * risk-level change an assessment produces is already carried on the
 * `ASSESSMENT` entry's own `previousValue`/`newValue` pair rather than as a
 * separate entry).
 */
export type RiskHistoryEntryType =
  'ASSESSMENT' | 'OWNERSHIP_CHANGE' | 'TREATMENT_DECISION' | 'LIFECYCLE_TRANSITION' | 'APPROVAL';

export interface RiskHistoryActorRecord {
  readonly id: string;
  readonly fullName: string;
}

/**
 * One merged, attributed history entry. `occurredAt` is documented in the
 * implementing service's header as the ordering timestamp (F-9's
 * resolution: the RECORDED instant, never an asserted business date) and
 * `assessedOn` is the asserted date the assessor supplied (only populated
 * for `type: 'ASSESSMENT'`) — kept as a SEPARATE field precisely so the two
 * are never flattened into one ambiguous value.
 *
 * `id` identifies the underlying source row (or, for `OWNERSHIP_CHANGE`,
 * the `audit_event` row) — it is what makes cross-page ordering provably
 * stable (paired with `occurredAt DESC` as the sort key) even though it is
 * not part of `contracts/risks.openapi.yaml`'s declared `RiskHistoryEntry`
 * shape (that schema does not set `additionalProperties: false`, so
 * exposing it is additive, not a contract violation).
 */
export interface RiskHistoryEntryRecord {
  readonly id: string;
  readonly type: RiskHistoryEntryType;
  readonly occurredAt: Date;
  readonly assessedOn: Date | null;
  readonly actor: RiskHistoryActorRecord;
  readonly summary: string;
  readonly previousValue: string | null;
  readonly newValue: string | null;
  readonly referenceId: string | null;
}

export interface RiskHistoryPage {
  readonly items: readonly RiskHistoryEntryRecord[];
  readonly total: number;
}

export interface RiskHistoryQuery {
  readonly riskId: string;
  readonly types?: readonly RiskHistoryEntryType[] | undefined;
  readonly page: number;
  readonly pageSize: number;
}

export abstract class RiskHistoryQueryPort {
  /** Access to `riskId` itself must already have been authorized by the
   * caller (`GetRiskHistoryUseCase`, via `RiskRepositoryPort.findById`
   * under the caller's `ScopeFilter`) — this method takes no scope
   * parameter of its own, matching every other risk-child repository in
   * this module (`RiskAssessmentRepositoryPort`, `ApprovalRepositoryPort`,
   * ...), which all trust the caller for the same reason. */
  abstract getHistory(query: RiskHistoryQuery): Promise<RiskHistoryPage>;
}
