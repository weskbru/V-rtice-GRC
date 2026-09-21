/**
 * T011/006-assets-processes — the ADR-020 part 3 boundary port between
 * `modules/assets` (the new owner of the `assets` table) and every other
 * module that needs to resolve an asset without reading the table directly.
 * Follows `shared/grc-ports/control-directory.port.ts` exactly — see that
 * file's header for the full reasoning this one does not repeat: closed,
 * minimal, read-only projection; lives in `shared/grc-ports/`, not
 * `grc/shared/`, because `Asset` is a business-module domain (data-model.md
 * §"Relações declaradas"), not a GRC-kernel concept.
 *
 * Two existing readers this port exists to replace, per data-model.md §8:
 *
 *   - `modules/controls/infrastructure/reference-registry-lookup.repository.ts`
 *     reads `prisma.asset` directly today.
 *   - `modules/risk/infrastructure/prisma-registry.repository.ts` reads
 *     `prisma.asset` directly today, for both `findById` and `list`.
 *
 * Replacing those two call sites is Fase 5's own scope (T036) — this port
 * only needs to EXIST and expose the right shape for that later work to
 * depend on; it is not consumed by either module in this fase.
 *
 * ## `orgUnitId` is mandatory in the exposed shape (ADR-020 part 4)
 *
 * This is the field a caller compares against the actor's resolved
 * organizational scope BEFORE writing a link (`RiskAssetLink`/
 * `ControlAssetLink`) — omitting it here would make ADR-020 part 4
 * impossible to satisfy for Risk->Asset and Control->Asset, exactly the
 * shape of the gap F-46 closed for Risco->Controle
 * (`control-directory.port.ts`'s own header). Nullable — not every `Asset`
 * row has an organizational unit yet (research.md D-2: the column stays
 * anulável; only NEW rows are required to carry one), the same
 * `string | null` shape `ControlDirectoryEntry.orgUnitId` already uses for
 * the identical reason on `Control` — a caller comparing `null` against any
 * concrete scope must refuse, never treat a missing unit as "in scope".
 */
/** The minimal, read-only projection of an `Asset` that a module other than
 * `modules/assets` may ever see (ADR-020 part 4). Deliberately excludes
 * `description` and timestamps — no cross-module caller needs them (the same
 * reasoning `ControlDirectoryEntry` already applies to `Control`'s own
 * excluded fields). */
export interface AssetDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}

export abstract class AssetDirectoryPort {
  /** Resolves one asset by id, or `undefined` if it does not exist.
   * Deliberately does NOT decide organizational scope itself — mirrors
   * `ControlDirectoryPort.findById`'s own contract: it returns the raw
   * entry and leaves the scope decision (and the resulting "not found"
   * collapse, FR-010) to the caller. */
  abstract findById(id: string): Promise<AssetDirectoryEntry | undefined>;

  /** Resolves many assets by id in a single round-trip — mirrors
   * `ControlDirectoryPort.findManyById`'s own contract exactly: order is
   * not guaranteed to match `ids`, an id with no matching asset is simply
   * absent from the result (never an `undefined` entry), and an empty
   * `ids` array returns an empty array without a round-trip. */
  abstract findManyById(ids: readonly string[]): Promise<readonly AssetDirectoryEntry[]>;
}
