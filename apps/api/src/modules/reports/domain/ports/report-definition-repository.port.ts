/**
 * 009-indicators-reports, Fase 2 (T014, data-model.md §8) + Fase 7 (T051/
 * T054). Foundation for `ReportDefinition`. `create` was T051's own
 * addition; `list`'s paginated, `isActive`-filterable shape below is T054's
 * own addition — `contracts/reports.openapi.yaml`'s `listReportDefinitions`
 * query parameters (`page`/`pageSize`/`isActive`), mirroring
 * `IndicatorDefinitionRepositoryPort.list`'s identical evolution across its
 * own module's phases. `updateWithVersion` remains out of THIS task's scope
 * (no `PATCH /reports/{id}` operation is implemented here — see
 * `report.controller.ts`'s own header for why).
 *
 * **No `ScopeFilter` anywhere in this file, deliberately** — same reasoning
 * as `modules/indicators/domain/ports/indicator-definition-repository.port.ts`:
 * `ReportDefinition` has no `orgUnitId` column (research.md D-8, data-model.md
 * §1), so there is no scope column for any method here to filter by.
 */
import type { ReportDefinitionRecord } from '../report-definition.entity';
import type { IndicatorMetricKey } from '@prisma/client';

export interface CreateReportDefinitionInput {
  /** Server-assigned via `EntityCodeGeneratorPort.nextCode('RPT', year)` —
   * never client-supplied (data-model.md §1, research.md D-9). */
  readonly code: string;
  readonly name: string;
  readonly description: string;
  /** Non-empty, already validated by `CreateReportDefinitionUseCase`
   * against the closed `IndicatorMetricKey` catalog — this port trusts its
   * caller rather than re-validating (the same division of labor
   * `IndicatorDefinitionRepositoryPort.create` follows for `metricKey`). */
  readonly metricKeys: readonly IndicatorMetricKey[];
  readonly createdByUserId: string;
}

export interface ReportDefinitionListQuery {
  readonly page: number;
  readonly pageSize: number;
  /** `undefined` = no filter (every row, active and inactive alike). */
  readonly isActive: boolean | undefined;
}

export interface ReportDefinitionListPage {
  readonly items: readonly ReportDefinitionRecord[];
  readonly total: number;
}

/** `PATCH /reports/{reportId}` (T068 prep, `updateReportDefinition`).
 * Every field `contracts/reports.openapi.yaml`'s `UpdateReportDefinitionRequest`
 * declares. `metricKeys`, when present, is already validated (non-empty,
 * closed catalog membership) by the CALLER
 * (`UpdateReportDefinitionUseCase`, via the same `assertValidReportMetricKeys`
 * `CreateReportDefinitionUseCase` uses) — this port trusts it, mirroring
 * `CreateReportDefinitionInput.metricKeys`'s own division of labor. */
export interface UpdateReportDefinitionChanges {
  readonly name?: string;
  readonly description?: string;
  readonly metricKeys?: readonly IndicatorMetricKey[];
  readonly isActive?: boolean;
}

export abstract class ReportDefinitionRepositoryPort {
  /** `undefined` when no report definition with this id exists — never
   * filtered by scope (research.md D-8). */
  abstract findById(id: string): Promise<ReportDefinitionRecord | undefined>;

  /** `GET /reports` (data-model.md §8: scope predicate "nenhum — catálogo
   * compartilhado"). Paginated and optionally filtered by `isActive`, per
   * `contracts/reports.openapi.yaml`'s `listReportDefinitions` query
   * parameters — no organizational-scope predicate exists to apply, because
   * the table has no such column. */
  abstract list(query: ReportDefinitionListQuery): Promise<ReportDefinitionListPage>;

  /** T051 — inserts one `report_definitions` row. Always created
   * `isActive: true` (schema default, FR-023) — no `isActive` field on this
   * input at all, the same convention `IndicatorDefinitionRepositoryPort.create`
   * follows. */
  abstract create(input: CreateReportDefinitionInput): Promise<ReportDefinitionRecord>;

  /** `PATCH /reports/{reportId}` (T068 prep). `undefined` when no
   * `ReportDefinition` with this id exists — the CALLER
   * (`UpdateReportDefinitionUseCase`) has already confirmed existence via
   * `findById` before calling this, so `undefined` here means a genuine
   * race, never the ordinary "not found" path — mirrors
   * `IndicatorDefinitionRepositoryPort.update`'s identical contract. */
  abstract update(
    id: string,
    changes: UpdateReportDefinitionChanges,
  ): Promise<ReportDefinitionRecord | undefined>;
}
