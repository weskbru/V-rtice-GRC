/**
 * T012/005-audit-findings — the ADR-020 part 3 boundary port between
 * `grc/finding` and `modules/risk`: the first port that lets a GRC-kernel
 * capability (not another business module) resolve a `Risk`'s identity
 * without importing `modules/risk` directly (research.md D-4). Mirrors
 * `control-directory.port.ts` exactly — see that file's header for the full
 * "why `shared/grc-ports/`, not `grc/shared/`" reasoning this one does not
 * repeat: `Risk` is a business-module domain (ADR-016 — Risk was the first
 * module ever built, predating the kernel/business split, but it still
 * fails the GRC-kernel admission test of §19.4: no other module could ever
 * be Risk's sole owner), so this is a module-to-module (here, module-to-
 * kernel) boundary, not a kernel capability living in `grc/shared/`.
 *
 * `shared/**` may not import from `core/**`, `grc/**` or `modules/**`
 * (`apps/api/eslint.config.mjs`), and this file imports nothing beyond a
 * TYPE-ONLY `@prisma/client`-free plain interface — so both `grc/finding`
 * and `modules/risk` may depend on it without violating that boundary in
 * either direction.
 *
 * ## The exposed shape is deliberately minimal (ADR-020 part 4)
 *
 * Exactly `{ id, code, title, orgUnitId, isActive }` — never `status`,
 * `ownerUserId`, `probability`, `impact`, `inherentLevel`/`residualLevel`.
 * None of that is `grc/finding`'s business: `FindingRiskLink` only ever
 * needs to know a risk EXISTS, is still relevant (not `ARCHIVED`), and
 * which organizational unit it belongs to.
 *
 * `isActive` is defined as `archivedAt === null` — DELIBERATELY more
 * permissive than `ControlDirectoryEntry.isActive` (`status === 'ACTIVE'`):
 * `Risk` has no single "operational" status the way `Control` does. Its
 * lifecycle (`DRAFT -> IDENTIFIED -> ASSESSED -> UNDER_TREATMENT ->
 * UNDER_REVIEW -> ACCEPTED -> CLOSED -> ARCHIVED`) has several states a
 * finding may legitimately point to — a finding referencing an `ACCEPTED`
 * or `CLOSED` risk is exactly the kind of historical link an audit needs to
 * preserve, not an error. Only `ARCHIVED` — the sole terminal, never-hard-
 * deleted state `schema.prisma` documents for `Risk.archivedAt` — is
 * excluded (research.md D-4).
 */
export interface RiskDirectoryEntry {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly orgUnitId: string;
  readonly isActive: boolean;
}

export abstract class RiskDirectoryPort {
  /** Resolves one risk by id, or `undefined` if it does not exist.
   * Deliberately does NOT hide/collapse organizational scope itself —
   * mirrors `ControlDirectoryPort.findById`'s own contract: the caller
   * (`LinkFindingToRiskUseCase`) makes the "out of scope" decision itself,
   * folding it into the same `422` refusal as "does not exist" (ADR-020
   * part 4). */
  abstract findById(id: string): Promise<RiskDirectoryEntry | undefined>;
}
