/**
 * T014/005-audit-findings — the ADR-020 part 3 boundary port between
 * `modules/audit-engagements` and `modules/compliance`: lets an engagement's
 * scope reference a `FrameworkVersion` without either module importing the
 * other (FR-017, SC-008). Mirrors `control-directory.port.ts` exactly — see
 * that file's header for the full reasoning this one does not repeat.
 *
 * ## No `orgUnitId` (unlike `ControlDirectoryPort`/`RiskDirectoryPort`)
 *
 * `FrameworkVersion` carries no organizational scope of its own — it is a
 * platform-wide normative catalog, gated only by `compliance:*` permission
 * (`004-compliance-management`, research.md D-2). ADR-020 part 4's "check
 * the referenced entity's scope before writing" therefore does not apply
 * literally to this pair — there is no scope to check (research.md D-11).
 *
 * `status` IS exposed here (unlike `ControlDirectoryEntry`/
 * `RiskDirectoryEntry`, which never expose their subject's own lifecycle
 * status) because `AuditScopeFrameworkVersion`'s own write-time precondition
 * — "the version must be `PUBLISHED`" (FR-006, research.md D-2) — depends
 * directly on it; this is not a leak of `modules/compliance`'s internal
 * domain shape, it is the one fact the consuming use case cannot do without.
 */
export interface FrameworkVersionDirectoryEntry {
  readonly id: string;
  readonly label: string;
  readonly status: 'DRAFT' | 'PUBLISHED';
  readonly frameworkId: string;
}

export abstract class FrameworkVersionDirectoryPort {
  abstract findById(id: string): Promise<FrameworkVersionDirectoryEntry | undefined>;
}
