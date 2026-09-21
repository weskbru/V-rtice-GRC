/**
 * T008/003-controls-management — the ADR-020 part 3 boundary port between
 * `modules/risk` and `modules/controls`: the FIRST real exercise of the
 * "porta em `shared/`, vínculo do lado que registra" pattern in this
 * codebase (research.md D-4). `RiskControlLink` stays exactly where it is
 * — owned by `modules/risk`, with a real FK to `controls` (data-model.md
 * §6) — but `modules/risk` no longer reads the `controls` table directly
 * to validate/resolve a control; it depends on this port instead.
 *
 * Lives in `shared/grc-ports/`, not `grc/shared/` — `Control` is a
 * business-module domain (ADR-016: it failed the GRC-kernel admission
 * test, "um módulo de Controles pode ser dono exclusivo"), so this is a
 * module-to-module boundary, not a kernel capability. ADR-020 part 3 names
 * `shared/` for exactly this case ("ou em `src/grc/` quando o conceito for
 * do núcleo GRC" — Control is not). `shared/**` may not import from
 * `core/**`, `grc/**` or `modules/**` (`apps/api/eslint.config.mjs`), and
 * this file imports nothing beyond a TYPE-ONLY `@prisma/client` import (an
 * external package, the same accepted exception every other `shared/**`
 * file in this codebase already relies on) — so both `modules/risk` and
 * `modules/controls` may depend on it without violating that boundary in
 * either direction.
 *
 * ## The exposed shape is deliberately minimal (ADR-020 part 4)
 *
 * Exactly `{ id, code, name, orgUnitId, isActive }` — never `status`,
 * `owner`, `nature`, `frequency` or `effectiveness`. None of that is
 * `modules/risk`'s business (data-model.md §6): the risk<->control
 * relationship only ever needed to know a control EXISTS, is ACTIVE, and
 * (for a future scope check — see below) WHICH organizational unit it
 * belongs to. Exposing the full `Control` domain model here would leak
 * `modules/controls`'s own domain type across the module boundary, which
 * is exactly what a port exists to prevent.
 *
 * ## `orgUnitId` is now consulted — closed 2026-09-08 (F-46,
 * `docs/deferred-findings.md`)
 *
 * ADR-020 part 4 requires the port to return the target's organizational
 * unit so the side that registers a link can verify scope BEFORE writing.
 * For a long stretch after this port shipped, `LinkControlUseCase`
 * (`modules/risk/application/links/control-link.usecase.ts`) carried
 * `orgUnitId` through this port without ever consulting it — it never read
 * `controls.org_unit_id` before this port existed either (only `isActive`
 * was ever checked), so the field sat unread on both sides of the
 * refactor that introduced it. Research.md D-4's own text once described
 * that refactor as recovering an EXISTING scope check; that description
 * did not match the module's actual pre-existing behavior, and D-4 has
 * since been corrected in place to say so. `LinkControlUseCase` now
 * resolves the control directly through THIS port (not
 * `ControlRegistryPort`, which never carried `orgUnitId` at all) and
 * checks `orgUnitId` against the actor's resolved scope before any write,
 * mirroring `LinkRequirementToControlUseCase`'s own check — see that
 * file's header for the full account, and
 * `test/integration/risk-control-link.spec.ts` for the proof.
 */
/** The minimal, read-only projection of a `Control` that a module other
 * than `modules/controls` may ever see (ADR-020 part 4). Deliberately
 * excludes `status`, `owner`, `nature`, `type`, `frequency` and derived
 * `effectiveness` — see this file's header for why. */
export interface ControlDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}

export abstract class ControlDirectoryPort {
  /** Resolves one control by id, or `undefined` if it does not exist.
   * Deliberately does NOT throw/hide on organizational scope itself —
   * unlike `EvidenceSubjectAccessor.resolveViewableSubject`'s "does not
   * exist / is out of scope / lacks permission" collapse, this port
   * returns the raw entry and leaves the scope decision to the caller.
   * Both callers (`LinkControlUseCase`, `LinkRequirementToControlUseCase`)
   * now make that decision themselves, folding "out of scope" into the
   * same refusal as "does not exist" — see this file's header. */
  abstract findById(id: string): Promise<ControlDirectoryEntry | undefined>;

  /**
   * T013/004-compliance-management (research.md D-9) — resolves many
   * controls by id in a single round-trip, for a batch caller that needs
   * every currently-linked control behind a set of requirements (up to the
   * 500-requirement scope `SC-008` bounds) rather than one `findById` call
   * per link. Purely additive: `findById` above is untouched, and every
   * existing caller (`modules/risk`) keeps calling it unchanged.
   *
   * Order is not guaranteed to match `ids`; an id with no matching control
   * is simply absent from the result (never `undefined` entries) — mirrors
   * `RoleRepositoryPort.findByIds`'s own "smaller result set signals a
   * missing id" convention. An empty `ids` array returns an empty array
   * without a round-trip, the same short-circuit
   * `PrismaRoleRepository.findByIds` already applies.
   */
  abstract findManyById(ids: readonly string[]): Promise<readonly ControlDirectoryEntry[]>;
}
