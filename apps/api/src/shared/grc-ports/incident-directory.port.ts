/**
 * 008-incidents-problems, foundation — the ADR-020-shaped boundary port
 * between `modules/problems` and `modules/incidents`: the write side of
 * `ProblemIncidentLink` (`POST`/`DELETE /problems/{problemId}/incidents`)
 * belongs to `modules/problems` (decision of the coordinator, spec.md
 * "Decisões do coordenador"; research.md D-14), but that module never
 * reads the `incidents` table directly to validate/resolve a target — it
 * depends on this port instead, exactly the pattern
 * `control-directory.port.ts` established for Risk->Control (see that
 * file's own header for the full reasoning this one deliberately does not
 * repeat).
 *
 * Lives in `shared/grc-ports/`, not `grc/shared/` — `Incident` is a
 * business-module domain, not a GRC-kernel capability (it does not pass
 * the §19.4 admission test: no third domain depends on it yet), so this is
 * a module-to-module boundary. `shared/**` may not import from `core/**`,
 * `grc/**` or `modules/**` (`apps/api/eslint.config.mjs`), and this file
 * imports nothing beyond a TYPE-ONLY `@prisma/client` import (the same
 * accepted exception every other `shared/**` file in this codebase already
 * relies on) — so both `modules/problems` and `modules/incidents` may
 * depend on it without violating that boundary in either direction.
 *
 * ## The exposed shape is deliberately minimal (ADR-020 part 4)
 *
 * Exactly `{ id, code, title, status, orgUnitId }` — never `description`,
 * `severity`, `reportedByUserId`/`ownerUserId`, or any resolution/closure
 * field. None of that is `modules/problems`'s business: the
 * Problem<->Incident link only ever needs to know the incident EXISTS, its
 * organizational unit (for the scope check ADR-020 part 4 requires BEFORE
 * a write), and enough to render a reference (`code`, `title`, `status`).
 * Exposing the full `Incident` domain model here would leak
 * `modules/incidents`'s own domain type across the module boundary, which
 * is exactly what a port exists to prevent.
 *
 * `orgUnitId` is `string`, never nullable, unlike `ControlDirectoryEntry`/
 * `AssetDirectoryEntry`'s own `string | null` — `Incident.orgUnitId` is a
 * required, non-nullable column (data-model.md D-8), so there is no
 * "missing organizational unit" case for a caller to handle here.
 *
 * ## `listIdsInScope` — also `modules/incidents`'s OWN internal read
 *
 * Added alongside `IncidentActionOriginAccessor` (spec.md FR-016,
 * research.md D-2): the bulk, scope-only listing `ActionOriginAccessor
 * .listOriginIdsInScope` requires (`action-origin-resolver.port.ts`).
 * Reused here rather than duplicated on a second, near-identical port —
 * this directory port already exposes exactly the projection an origin
 * accessor needs, and `modules/incidents` is free to depend on its own
 * port for its own internal use, the same way `ControlAssessmentActionOriginAccessor`
 * depends on `ControlAssessmentRepositoryPort`'s own `listAssessmentIdsInScope`.
 */
import type { UnitScopeFilter } from '../persistence/scope-filter';
import type { IncidentStatus } from '@prisma/client';

/** The minimal, read-only projection of an `Incident` that a module other
 * than `modules/incidents` may ever see (ADR-020 part 4). */
export interface IncidentDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatus;
  readonly orgUnitId: string;
}

export abstract class IncidentDirectoryPort {
  /** Resolves one incident by id, or `undefined` if it does not exist.
   * Deliberately does NOT decide organizational scope itself — mirrors
   * `ControlDirectoryPort.findById`'s own contract: it returns the raw
   * entry and leaves the scope decision (and the resulting "not found"
   * collapse, spec.md FR-014) to the caller. */
  abstract findById(id: string): Promise<IncidentDirectoryEntry | undefined>;

  /** Resolves many incidents by id in a single round-trip — mirrors
   * `ControlDirectoryPort.findManyById`'s own contract exactly: order is
   * not guaranteed to match `ids`, an id with no matching incident is
   * simply absent from the result (never an `undefined` entry), and an
   * empty `ids` array returns an empty array without a round-trip. */
  abstract findManyById(ids: readonly string[]): Promise<readonly IncidentDirectoryEntry[]>;

  /** Every incident id whose CURRENT `orgUnitId` is included in
   * `scope.unitIds` — a single query, never one call per candidate id.
   * Mirrors `RiskRepositoryPort.listIdsInScope`'s own contract exactly. */
  abstract listIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]>;
}
