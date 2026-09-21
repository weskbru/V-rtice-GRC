/**
 * T014/004-compliance-management — the second ADR-020 boundary port
 * between a business module and `modules/controls`, alongside
 * `control-directory.port.ts` (research.md D-9). `modules/compliance`
 * needs the control's DERIVED effectiveness verdict — a fact of
 * `modules/controls`'s own domain (§19.7: "calculado por um único ponto")
 * — to compute `RequirementComplianceState` (data-model.md §7). This is a
 * distinct concern from `ControlDirectoryPort` (identity/scope, "o mínimo
 * para verificar antes de gravar" — ADR-020 part 4) and is therefore a
 * SECOND port, not an extension of the first: `ControlDirectoryPort`'s own
 * header documents that it deliberately excludes `effectiveness`, and
 * every existing consumer of that port (`modules/risk`) only ever needed
 * identity/scope, never the derived verdict.
 *
 * Lives in `shared/grc-ports/`, not `grc/shared/`, for the identical
 * reason `control-directory.port.ts` does — `Control` is a business-module
 * domain (ADR-016), so this is a module-to-module boundary, not a kernel
 * capability. `shared/**` may not import from `core/**`, `grc/**` or
 * `modules/**` (`apps/api/eslint.config.mjs`); this file has no import at
 * all, so both `modules/compliance` and `modules/controls` may depend on
 * it without violating that boundary in either direction.
 *
 * ## `ControlEffectivenessLevel` — a deliberate, minimal duplication of a
 * closed vocabulary, never of a rule
 *
 * These five values are exactly `ControlEffectiveness`
 * (`modules/controls/domain/control-effectiveness.service.ts`), declared a
 * second time rather than imported — importing would require
 * `shared/grc-ports/**` to depend on `modules/controls/**`, which
 * `modules/compliance` (a permitted importer of this same file) would then
 * transitively depend on too, exactly the cross-module coupling ADR-020
 * exists to prevent. `CONTROL_EFFECTIVENESS_LEVELS` below is exported so a
 * runtime parity test (`control-effectiveness-level-parity.spec.ts`, T016)
 * can prove, over real values rather than by convention, that this
 * duplicated vocabulary and the domain's own never drift apart — the same
 * guarantee `ControlDirectoryEntry`'s own minimal-projection choice
 * accepted without a parity test, because a projection of FIELDS has no
 * runtime "did the two enums drift" question a value set does.
 */
export type ControlEffectivenessLevel =
  'NOT_ASSESSED' | 'EFFECTIVE' | 'PARTIALLY_EFFECTIVE' | 'INEFFECTIVE' | 'EXPIRED';

/** Runtime enumeration of every `ControlEffectivenessLevel` value — see
 * this file's header for why this exists (a type alone is erased at
 * runtime and cannot be compared against `modules/controls`'s own runtime
 * vocabulary). Order does not matter to any consumer; it mirrors
 * `ControlEffectiveness`'s own declaration order for readability only. */
export const CONTROL_EFFECTIVENESS_LEVELS: readonly ControlEffectivenessLevel[] = [
  'NOT_ASSESSED',
  'EFFECTIVE',
  'PARTIALLY_EFFECTIVE',
  'INEFFECTIVE',
  'EXPIRED',
];

export abstract class ControlEffectivenessPort {
  /**
   * Resolves the CURRENT derived effectiveness of every id in
   * `controlIds`, as of `referenceDate` — one batched read, never one call
   * per control (research.md D-9's own "uma consulta em lote"). An id with
   * no matching control is simply absent from the returned map (never a
   * fabricated `NOT_ASSESSED` entry) — the caller (`modules/compliance`)
   * is expected to already know which ids are real controls via
   * `ControlDirectoryPort`, so a missing map entry here signals nothing
   * new. An empty `controlIds` array returns an empty map without a
   * round-trip.
   *
   * `referenceDate` is required, never defaulted or read from the clock
   * inside an implementation — the same discipline
   * `calculateControlEffectiveness`'s own header documents: one "now" per
   * request, supplied by the caller, never one per row.
   */
  abstract getEffectivenessBatch(
    controlIds: readonly string[],
    referenceDate: Date,
  ): Promise<ReadonlyMap<string, ControlEffectivenessLevel>>;
}
