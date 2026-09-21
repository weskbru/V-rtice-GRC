/**
 * PharosGRC frontend — Problem types (008-incidents-problems, US2/US3).
 *
 * Frontend-facing scaffold (coordinator instruction, 2026-09-11) — see
 * `features/incidents/types.ts`'s own header comment for the full
 * reasoning: every type below is a direct alias into the GENERATED
 * `@pharos/api-types` `Problems` namespace
 * (`packages/api-types/src/generated/problems.ts`, produced from
 * `specs/008-incidents-problems/contracts/problems.openapi.yaml`), never a
 * hand-written mirror.
 *
 * `Problems.components['schemas']['IncidentRef']`/`IncidentStatusRef` are
 * THIS document's own read-only projection of the linked `Incident` —
 * `incidents.openapi.yaml` owns the full `Incident` shape. Problems owns
 * the WRITE side of the shared many-to-many (research.md D-14): unlike
 * `features/incidents/api.ts`, `features/problems/api.ts` exposes both
 * `linkToIncident` and `unlinkFromIncident`.
 */
import type { Problems } from '@pharos/api-types';

export type ProblemSeverity = Problems.components['schemas']['ProblemSeverity'];
export type ProblemStatus = Problems.components['schemas']['ProblemStatus'];

/** `{id, code, name}` — this contract's own `OrgUnitRef`. */
export type OrgUnitRef = Problems.components['schemas']['OrgUnitRef'];

/** `{id, fullName, email?}` — this contract's own `UserRef`. */
export type UserRef = Problems.components['schemas']['UserRef'];

export type RiskRef = Problems.components['schemas']['RiskRef'];
/** This module's own read-only projection of the linked `Incident` — `incidents.openapi.yaml` owns the full `Incident` shape. */
export type IncidentRef = Problems.components['schemas']['IncidentRef'];
export type IncidentStatusRef = Problems.components['schemas']['IncidentStatusRef'];

export type ProblemSummary = Problems.components['schemas']['ProblemSummary'];
export type ProblemDetail = Problems.components['schemas']['ProblemDetail'];

export type CreateProblemRequest = Problems.components['schemas']['CreateProblemRequest'];
export type UpdateProblemRequest = Problems.components['schemas']['UpdateProblemRequest'];
export type TransitionProblemRequest = Problems.components['schemas']['TransitionProblemRequest'];

export type ProblemRiskLinkResponse = Problems.components['schemas']['ProblemRiskLinkResponse'];
/** Problems owns the WRITE side of this link (research.md D-14) — `features/problems/api.ts` is the only place `linkToIncident`/`unlinkFromIncident` exist. */
export type ProblemIncidentLinkResponse =
  Problems.components['schemas']['ProblemIncidentLinkResponse'];

/** `GET /problems`'s own envelope — `{data, meta}`, aligned with every other paginated register endpoint in the platform (see `IncidentListResponse`'s own doc comment in `features/incidents/types.ts`). */
export type ProblemListResponse =
  Problems.operations['listProblems']['responses']['200']['content']['application/json'];

/** `POST /problems/{problemId}/risks`'s inline request body. */
export type LinkProblemToRiskRequest =
  Problems.operations['linkProblemToRisk']['requestBody']['content']['application/json'];
/** `POST /problems/{problemId}/incidents`'s inline request body — the write side of the shared link (D-14). */
export type LinkProblemToIncidentRequest =
  Problems.operations['linkProblemToIncident']['requestBody']['content']['application/json'];

/** `GET /problems` query parameters this client builds — see `IncidentRegisterQuery`'s own doc comment in `features/incidents/types.ts` for why this is not itself a generated shape. */
export interface ProblemRegisterQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly status?: readonly ProblemStatus[];
  readonly severity?: readonly ProblemSeverity[];
  readonly orgUnitId?: string;
  readonly sort?: 'code' | 'title' | 'severity' | 'status' | 'identifiedOn' | 'updatedAt';
  readonly direction?: 'asc' | 'desc';
}
