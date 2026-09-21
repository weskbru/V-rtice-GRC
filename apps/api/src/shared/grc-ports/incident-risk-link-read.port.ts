/**
 * 013-incidents-problems-reverse-links — the ADR-020 part 3 boundary port
 * for the REVERSE direction of the Incident<->Risk relationship:
 * `modules/risk` reading the `IncidentRiskLink` row that `modules/incidents`
 * owns (`GET /risks/{riskId}/incidents`). Mirrors
 * `shared/grc-ports/risk-control-link-read.port.ts` exactly, for a
 * different pair — see that file's own header for the full account of why
 * this shape (interface here, adapter in the OWNING module, binding module
 * marked `@Global()`) is this codebase's one established pattern for a
 * reverse read of a link table owned by another module, not a new one
 * invented for this phase (CLAUDE.md §19.4).
 *
 * "Read-only by design": `IncidentRiskLink` is created/withdrawn only from
 * `POST`/`DELETE /incidents/{incidentId}/risks` on the Incident side
 * (`link-incident-risk.usecase.ts`) — this port exposes the one link table
 * that already exists, never a second vínculo (CLAUDE.md §19.3).
 *
 * `modules/incidents` (the OWNING module) provides the adapter
 * (`modules/incidents/infrastructure/incident-risk-link-read.adapter.ts`,
 * bound by `modules/incidents/incident-risk-link-read.module.ts`, a small
 * `@Global()` module `IncidentsModule` itself imports — the same shape
 * `RiskModule`/`RiskControlLinkReadModule` establish for the opposite
 * direction). Neither module imports the other.
 *
 * ## The exposed shape is deliberately minimal (ADR-020 part 4)
 *
 * `IncidentRefRecord` is exactly `{ id, code, title, status }` — never
 * `severity`, `description`, `ownerUserId`, `orgUnitId` or any other
 * `Incident` domain field. `ListRiskIncidentLinksUseCase` only ever needs
 * to say WHICH incident references this risk, for display — not to
 * reproduce the Incident aggregate on the Risk side. This port never
 * registers anything, so it carries no organizational-scope field either:
 * this port only lists links a risk's own scope has already been checked
 * for (by `GetRiskUseCase`, on the Risk side, before this port is ever
 * called) — adding a scope field here would be exactly the "expose more
 * than the minimum" ADR-020 part 4 forbids. `status` is included (unlike
 * `RiskRefRecord`'s own three fields) because it mirrors the one existing
 * precedent for a reverse read INTO this same pair of modules —
 * `IncidentProblemLinkReadPort`'s own `ProblemRef` already carries
 * `status` for the identical reason: the linked record's lifecycle state
 * is exactly the kind of "is this still live" signal a relationship panel
 * exists to show.
 */
import type { IncidentStatus } from '@prisma/client';

export interface IncidentRefRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatus;
}

export interface IncidentLinkUserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentRiskLinkReadRecord {
  readonly id: string;
  readonly incident: IncidentRefRecord;
  readonly linkedBy: IncidentLinkUserRefRecord;
  readonly linkedAt: Date;
  // No `unlinkedBy` — mirrors `IncidentRiskLinkResponse`/`IncidentProblemLinkResponse`'s
  // own precedent (incidents.openapi.yaml): who withdrew the link is not
  // exposed on this same entity's reverse read either, only that it was.
  readonly unlinkedAt: Date | undefined;
}

export abstract class IncidentRiskLinkReadPort {
  abstract listByRisk(
    riskId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly IncidentRiskLinkReadRecord[]>;
}
