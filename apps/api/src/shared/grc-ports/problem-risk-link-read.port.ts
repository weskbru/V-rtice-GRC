/**
 * 013-incidents-problems-reverse-links — the ADR-020 part 3 boundary port
 * for the REVERSE direction of the Problem<->Risk relationship:
 * `modules/risk` reading the `ProblemRiskLink` row that `modules/problems`
 * owns (`GET /risks/{riskId}/problems`). Mirrors
 * `incident-risk-link-read.port.ts` exactly, for `Problem` instead of
 * `Incident` — see that file's own header for the full reasoning this one
 * deliberately does not repeat.
 *
 * "Read-only by design": `ProblemRiskLink` is created/withdrawn only from
 * `POST`/`DELETE /problems/{problemId}/risks` on the Problem side
 * (`link-problem-risk.usecase.ts`).
 *
 * `modules/problems` (the OWNING module) provides the adapter
 * (`modules/problems/infrastructure/problem-risk-link-read.adapter.ts`,
 * bound by `modules/problems/problem-risk-link-read.module.ts`, `@Global()`
 * — `ProblemsModule` itself imports it).
 *
 * `status` is included on `ProblemRefRecord`, matching
 * `IncidentProblemLinkReadPort`'s own `ProblemRef` (the one existing
 * precedent for a reverse read exposing this exact record).
 */
import type { ProblemStatus } from '@prisma/client';

export interface ProblemRefRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: ProblemStatus;
}

export interface ProblemLinkUserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface ProblemRiskLinkReadRecord {
  readonly id: string;
  readonly problem: ProblemRefRecord;
  readonly linkedBy: ProblemLinkUserRefRecord;
  readonly linkedAt: Date;
  // No `unlinkedBy` — mirrors `IncidentRiskLinkResponse`/`IncidentProblemLinkResponse`'s
  // own precedent (incidents.openapi.yaml): who withdrew the link is not
  // exposed on this same entity's reverse read either, only that it was.
  readonly unlinkedAt: Date | undefined;
}

export abstract class ProblemRiskLinkReadPort {
  abstract listByRisk(
    riskId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly ProblemRiskLinkReadRecord[]>;
}
