/**
 * PharosGRC frontend — Report types (009-indicators-reports, T062/T061).
 *
 * Every type below is a direct alias into the GENERATED `@pharos/api-types` `Reports` namespace
 * (`packages/api-types/src/generated/reports.ts`, produced from `specs/009-indicators-reports/
 * contracts/reports.openapi.yaml`) — never a hand-written mirror, following the same convention
 * `features/incidents/types.ts`/`features/indicators/types.ts` document.
 *
 * `IndicatorMetricKey` is `reports.openapi.yaml`'s OWN copy of the eleven-value catalog, not
 * `features/indicators/types.ts`'s — the contract's own header explains why it is duplicated
 * rather than referenced across documents (each contract in this platform is self-contained).
 * Both generated unions happen to be structurally identical string-literal unions; aliasing this
 * module's own name from `Reports` (rather than `Indicators`) keeps this feature's types traceable
 * to the contract that actually governs `/reports`.
 *
 * `getReportDefinition`/`updateReportDefinition` are declared in the contract but deliberately NOT
 * implemented by `ReportController` (that file's own header comment) — no `ReportDefinition`
 * single-fetch-by-id or edit type is aliased here for the same reason: there is nothing behind it
 * to call. The execution screen (`ReportRunDialog`) therefore works from the `ReportDefinition`
 * object already loaded by the catalog list, never a second per-id fetch.
 */
import type { Reports } from '@pharos/api-types';

/** `reports.openapi.yaml`'s own copy of the closed, eleven-value catalog (data-model.md §3). */
export type IndicatorMetricKey = Reports.components['schemas']['IndicatorMetricKey'];

/** Whether the server applied an organizational-unit predicate, or the source has none. */
export type IndicatorScopeApplicability =
  Reports.components['schemas']['IndicatorScopeApplicability'];

/** `{id, fullName, email?}` — this contract's own `UserRef`, declared locally rather than imported cross-module (CLAUDE.md §2/§4), mirroring every other feature's own copy. */
export type UserRef = Reports.components['schemas']['UserRef'];

export type ReportDefinition = Reports.components['schemas']['ReportDefinition'];
export type CreateReportDefinitionRequest =
  Reports.components['schemas']['CreateReportDefinitionRequest'];

export type ReportRunItem = Reports.components['schemas']['ReportRunItem'];
export type ReportRunResult = Reports.components['schemas']['ReportRunResult'];

/** `GET /reports`'s own envelope — `{data, meta}`, aligned with every other paginated register endpoint in the platform (this contract's own `info.description` explains the correction from `008-incidents-problems`'s original `{items}` divergence). */
export type ReportDefinitionListResponse =
  Reports.operations['listReportDefinitions']['responses']['200']['content']['application/json'];

/**
 * `GET /reports` query parameters this client builds — not itself a generated shape (query
 * strings are not typed by `openapi-typescript`'s `operations[...]` the way JSON bodies are),
 * named locally the same way `features/indicators/types.ts`'s own `IndicatorDefinitionListQuery`
 * is. Deliberately only `page`/`pageSize`/`isActive` — the only parameters
 * `listReportDefinitions` actually declares.
 */
export interface ReportDefinitionListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly isActive?: boolean;
}
