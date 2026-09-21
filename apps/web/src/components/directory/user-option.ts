/**
 * PharosGRC — S-10 (seletores de responsável/gestor/dono sem busca no
 * servidor). Domain-agnostic shape every user-picker in this directory
 * works with — deliberately narrower than any single feature's own
 * `UserRef` (some carry `email`, some don't; `GrcFoundation.UserRef` has no
 * `email` at all) so every feature's existing `UserRef` is already
 * assignable here without a cast.
 */
export interface UserOption {
  readonly id: string;
  readonly fullName: string;
  /** Shown as secondary text so near-identical names (e.g. many seeded
   * "E2E Auth Journey" fixtures, A1-report.md) are distinguishable — see
   * `UserPicker`'s own header comment. Optional because `GrcFoundation
   * .UserRef` (`Action.responsible`, ...) does not carry it. */
  readonly email?: string;
}

/** What one user search resolves to — mirrors `SearchablePickerResult`
 * (`isPartial` always server-told, never guessed, same reasoning as that
 * type's own doc comment). */
export interface UserSearchResult {
  readonly data: readonly UserOption[];
  readonly isPartial: boolean;
}
