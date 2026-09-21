/**
 * T049/004-compliance-management, User Story 3 (research.md D-11) — the
 * observation-time watermark's own result shape. The three outcomes below
 * are exhaustive and each maps to exactly one caller action:
 *
 * - `CREATED` — no mark existed yet; one now does, with today's fresh
 *   value. Never audited: there is no real "before" to compare against
 *   (D-11's own "a marca inicial nunca é mudança").
 * - `CHANGED` — a mark existed with a DIFFERENT state; it has been
 *   updated, atomically, to the fresh value. The caller records exactly
 *   one `REQUIREMENT_COMPLIANCE_STATE` audit event with `previousState`.
 * - `UNCHANGED` — a mark existed with the SAME state; nothing was
 *   written. The caller records nothing — this is also the outcome a
 *   losing concurrent writer sees (research.md D-11's own concurrency
 *   case), since the conditional `UPDATE ... WHERE ... IS DISTINCT FROM`
 *   only the repository implements can produce it race-free.
 */
import type { RequirementComplianceState } from '@prisma/client';

export type ComplianceAuditMarkObservation =
  | { readonly outcome: 'CREATED' }
  | { readonly outcome: 'UNCHANGED' }
  | { readonly outcome: 'CHANGED'; readonly previousState: RequirementComplianceState };
