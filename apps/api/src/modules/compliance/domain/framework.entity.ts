/**
 * T020/004-compliance-management — domain rules that live WITH the
 * `Framework` entity (data-model.md §1, FR-001/FR-002). Pure domain logic:
 * no I/O, no Prisma, no framework import — matching
 * `modules/controls/domain/control.entity.ts`'s own accepted pattern.
 *
 * ## Why this file has no function, unlike `control.entity.ts`
 *
 * `Control` has a real derived invariant (`isActiveForControlStatus`) this
 * file's counterpart would mirror. `Framework` has none: it carries no
 * status, no derived boolean, no lifecycle of its own (research.md D-2/
 * D-3 — the framework itself is never published or retired; only its
 * VERSIONS are, and that lifecycle lives in
 * `framework-version-lifecycle.ts`). This is a considered absence, not a
 * missing file: `FrameworkRecord` below is a plain data shape, and every
 * rule this entity is subject to (code immutability after creation,
 * optimistic-lock version) is the SAME generic mechanism `Control`/`Risk`
 * already share — there is no Framework-specific derived rule to
 * calculate. A future FR that adds one (e.g. an aggregate "how many
 * PUBLISHED versions does this framework have") would add its function
 * here, not invent a second file.
 */
import type { FrameworkOrigin } from '@prisma/client';

/** One `Framework`, exactly as the presentation layer's mapper needs it —
 * mirrors `ControlRecord`'s own convention of a plain domain-level shape,
 * never a re-export of a Prisma model (ADR-009). */
export interface FrameworkRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly origin: FrameworkOrigin;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
