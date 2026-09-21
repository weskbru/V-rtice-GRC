/**
 * PharosGRC frontend — Incident types (008-incidents-problems, US1/US3).
 *
 * Frontend-facing scaffold (coordinator instruction, 2026-09-11): every
 * type below is a direct alias into the GENERATED `@pharos/api-types`
 * `Incidents` namespace (`packages/api-types/src/generated/incidents.ts`,
 * produced from `specs/008-incidents-problems/contracts/incidents.openapi
 * .yaml`) — never a hand-written mirror. This is deliberately the first
 * module in this repository whose transport types were never hand-copied
 * first and reconciled with the generator later (the pattern
 * `evidence/types.ts`'s own header comment documents, and the one
 * assurance-audit Fix 3 had to close for `OrgUnitRef` after the fact). The
 * backend behind this contract does not exist yet (a separate front is
 * building it) — that has no bearing on this file, since the generator's
 * only input is the hand-authored contract, never the running API.
 *
 * Enum unions (`IncidentSeverity`/`IncidentStatus`) ARE re-exported from the
 * generated schema directly, unlike `evidence/types.ts`'s own enums (which
 * stayed hand-declared because their generated form would have been
 * spuriously optional — that gap does not exist here: `IncidentSeverity`/
 * `IncidentStatus` generate as exact string-literal unions). `lib/messages
 * /incidents.ts`'s `satisfies Record<IncidentStatus, string>` still gives
 * the same "new enum value is a compile error" guarantee (F-1) — it just
 * reads the union from here instead of redeclaring it.
 */
import type { Incidents } from '@pharos/api-types';

export type IncidentSeverity = Incidents.components['schemas']['IncidentSeverity'];
export type IncidentStatus = Incidents.components['schemas']['IncidentStatus'];

/** `{id, code, name}` — this contract's own `OrgUnitRef` (stricter than `GrcFoundation`'s `{id, name}`; matches `Risks`'/`Assets`'/`Processes`' own copies). */
export type OrgUnitRef = Incidents.components['schemas']['OrgUnitRef'];

/** `{id, fullName, email?}` — this contract's own `UserRef`. */
export type UserRef = Incidents.components['schemas']['UserRef'];

export type RiskRef = Incidents.components['schemas']['RiskRef'];
export type AssetRef = Incidents.components['schemas']['AssetRef'];
export type ProcessRef = Incidents.components['schemas']['ProcessRef'];
/** This module's own read-only projection of the linked `Problem` — `problems.openapi.yaml` owns the full `Problem` shape (research.md D-14). */
export type ProblemRef = Incidents.components['schemas']['ProblemRef'];
export type ProblemStatusRef = Incidents.components['schemas']['ProblemStatusRef'];

export type IncidentSummary = Incidents.components['schemas']['IncidentSummary'];
export type IncidentDetail = Incidents.components['schemas']['IncidentDetail'];

export type CreateIncidentRequest = Incidents.components['schemas']['CreateIncidentRequest'];
export type UpdateIncidentRequest = Incidents.components['schemas']['UpdateIncidentRequest'];
export type TransitionIncidentRequest =
  Incidents.components['schemas']['TransitionIncidentRequest'];

export type IncidentRiskLinkResponse = Incidents.components['schemas']['IncidentRiskLinkResponse'];
export type IncidentAssetLinkResponse =
  Incidents.components['schemas']['IncidentAssetLinkResponse'];
export type IncidentProcessLinkResponse =
  Incidents.components['schemas']['IncidentProcessLinkResponse'];
/** Read-only from this side — see `relationships.problems` in `lib/messages/incidents.ts`'s own doc comment. */
export type IncidentProblemLinkResponse =
  Incidents.components['schemas']['IncidentProblemLinkResponse'];

/** `GET /incidents`'s own envelope — `{data, meta}`, aligned with every other paginated register endpoint in the platform (the presentation layer maps the repository port's own `items` field to `data` at the HTTP boundary, mirroring `risk.controller.ts` and every other controller). */
export type IncidentListResponse =
  Incidents.operations['listIncidents']['responses']['200']['content']['application/json'];

/** `POST /incidents/{incidentId}/risks`'s inline request body — never a named component in the contract, so aliased from the operation itself rather than re-declared as `{ riskId: string }` a second time. */
export type LinkIncidentToRiskRequest =
  Incidents.operations['linkIncidentToRisk']['requestBody']['content']['application/json'];
export type LinkIncidentToAssetRequest =
  Incidents.operations['linkIncidentToAsset']['requestBody']['content']['application/json'];
export type LinkIncidentToProcessRequest =
  Incidents.operations['linkIncidentToProcess']['requestBody']['content']['application/json'];

/** `GET /incidents` query parameters this client builds — not itself a generated shape (query strings are not typed by `openapi-typescript`'s `operations[...]` the way JSON bodies are), named locally the same way `risks/types.ts`'s own `RiskRegisterQuery` is. */
export interface IncidentRegisterQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: readonly IncidentStatus[];
  readonly severity?: readonly IncidentSeverity[];
  readonly orgUnitId?: string;
  readonly sort?: 'code' | 'title' | 'severity' | 'status' | 'reportedOn' | 'updatedAt';
  readonly direction?: 'asc' | 'desc';
}
