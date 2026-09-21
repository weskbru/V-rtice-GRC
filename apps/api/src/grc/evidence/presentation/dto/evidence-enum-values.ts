/**
 * The `EvidenceSubjectType` values the HTTP boundary accepts — derived from
 * the Prisma enum, never retyped.
 *
 * ## Why this file exists
 *
 * It exists because the list WAS retyped, twice, and then went stale.
 * `link-evidence-request.dto.ts` and `list-evidence-query.dto.ts` each held
 * their own hand-written copy of the four values the enum had when they were
 * written. Phase 2 (Controls) added `CONTROL` to the Prisma enum, registered
 * its accessor, and covered it with an integration test that passed — while
 * every evidence request naming a control was rejected at the DTO with a
 * `400`, because both copies still listed only four values.
 *
 * The capability was declared, wired, tested at the layer below, and dead at
 * the edge. It was found by looking at the rendered application, not by any
 * gate — which is the recurring failure this project keeps recording.
 *
 * `Object.values(EvidenceSubjectType)` cannot go stale: adding a member to
 * `schema.prisma` widens this automatically. The companion guard
 * (`test/unit/evidence-subject-registry-guard.spec.ts`) is the other half —
 * it fails if a member reaches the enum without an accessor registered, so
 * "accepted at the edge" and "resolvable in the domain" cannot drift apart
 * in either direction.
 */
import { EvidenceSubjectType } from '@prisma/client';

export const EVIDENCE_SUBJECT_TYPE_VALUES: readonly EvidenceSubjectType[] =
  Object.values(EvidenceSubjectType);
