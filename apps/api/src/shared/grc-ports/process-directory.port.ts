/**
 * T012/006-assets-processes — the `Process` counterpart of
 * `asset-directory.port.ts`, identical in shape and reasoning (FR-020: Asset
 * and Process are promoted symmetrically, deliberately). See that file's
 * header for the full account this one does not repeat.
 *
 * Replaces the same two direct readers, on the `processes` table instead of
 * `assets`:
 *   - `modules/controls/infrastructure/reference-registry-lookup.repository.ts`
 *   - `modules/risk/infrastructure/prisma-registry.repository.ts`
 *
 * Replacing those call sites is Fase 5's own scope (T036) — this port only
 * needs to EXIST and expose the right shape for that later work to depend
 * on.
 */
/** The minimal, read-only projection of a `Process` that a module other
 * than `modules/processes` may ever see (ADR-020 part 4). Deliberately
 * excludes `description` and timestamps — mirrors
 * `AssetDirectoryEntry`'s own exclusions exactly (FR-020). */
export interface ProcessDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly orgUnitId: string | null;
  readonly isActive: boolean;
}

export abstract class ProcessDirectoryPort {
  /** Resolves one process by id, or `undefined` if it does not exist. See
   * `AssetDirectoryPort.findById`'s own doc comment — identical contract. */
  abstract findById(id: string): Promise<ProcessDirectoryEntry | undefined>;

  /** Resolves many processes by id in a single round-trip. See
   * `AssetDirectoryPort.findManyById`'s own doc comment — identical
   * contract. */
  abstract findManyById(ids: readonly string[]): Promise<readonly ProcessDirectoryEntry[]>;
}
