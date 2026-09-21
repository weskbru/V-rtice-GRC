/**
 * T022/004-compliance-management — `FrameworkVersion`'s lifecycle
 * (research.md D-3, data-model.md §2): exactly two states, ONE legal
 * transition (`DRAFT -> PUBLISHED`), irreversible. Deliberately NOT a
 * transition table like `control-lifecycle.ts`'s
 * `CONTROL_LIFECYCLE_TRANSITIONS` — see research.md D-3's own "por que não
 * uma tabela de transições" for the full reasoning this file does not
 * repeat: a single edge that fires at most once, for a lifecycle with no
 * other state to reach, does not justify the mechanism `Control`'s four
 * states and six transition pairs earn.
 *
 * Pure domain: no I/O, no framework import (`eslint-plugin-boundaries`
 * enforces this at `module-domain`) — `FrameworkVersionStatus` is imported
 * only as a TYPE from `@prisma/client`, the same accepted pattern
 * `control.entity.ts`'s own header documents.
 */
import type { FrameworkVersionStatus } from '@prisma/client';

/** `true` only from `DRAFT` — the one state `publishFrameworkVersion` may
 * act on. `PUBLISHED` is terminal: there is no operation, in this contract
 * or any future one this research decision anticipates, that reverts it
 * (research.md D-3). */
export function canPublishFrameworkVersion(status: FrameworkVersionStatus): boolean {
  return status === 'DRAFT';
}

/**
 * `true` only while `DRAFT` — governs both `UpdateFrameworkVersionUseCase`
 * (the version's own `label`, FR-006: "publicar... fixa a identidade da
 * versão também") and, indirectly, every `Requirement` belonging to this
 * version (FR-004): a clause is editable exactly as long as its parent
 * version is. Named distinctly from `canPublishFrameworkVersion` even
 * though the two currently share an identical body — they answer two
 * different domain questions ("may I publish this?" vs. "may I still edit
 * this version's own fields or its requirements?") that happen to collapse
 * onto the same two-state lifecycle today, and a future third state (see
 * this module's own header, "se uma fase futura precisar de mais
 * estados") could make them diverge without every call site needing to be
 * re-audited for which question it was actually asking.
 */
export function isFrameworkVersionEditable(status: FrameworkVersionStatus): boolean {
  return status === 'DRAFT';
}
