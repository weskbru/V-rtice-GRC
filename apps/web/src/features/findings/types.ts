/**
 * PharosGRC frontend — Finding types (T075, 002-shared-grc-foundation, US3).
 *
 * The entity/request interfaces below remain hand-written against
 * `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml`,
 * the same reason `features/evidence/types.ts`'s own header comment gives —
 * the contract's `required` arrays under-declare fields the real API always
 * returns, so the generated `Finding` type would be spuriously more
 * `undefined`-permissive than the hand-written one.
 *
 * `OrgUnitRef`/`UserRef` are the exception (see `evidence/types.ts`'s own
 * comment for why they carry no such optionality gap): now sourced from
 * `@pharos/api-types`'s generated `GrcFoundation` namespace rather than
 * RISKS-domain `OrgUnitRef` (`risks.openapi.yaml`, which additionally
 * requires `code` — a field this API never returns; the concrete "type
 * lie" the assurance audit found here and in `evidence/types.ts`).
 *
 * Enum unions still live in `lib/messages/findings.ts`, not the generated
 * schema — see `evidence/types.ts`'s own comment for why (the
 * `satisfies Record<X, string>` exhaustiveness guarantee).
 *
 * T075/005-audit-findings extends this file in two ways:
 *
 * 1. `Finding.auditEngagementId` — a new nullable field on the existing
 *    `grc-foundation.openapi.yaml` `Finding` schema (null for a finding
 *    recorded manually via `POST /findings`; set, and never changeable
 *    afterward, for one produced by `POST /audits/{auditId}/findings`).
 * 2. `FindingControlLink`/`FindingRiskLink` and their request/response
 *    supporting types, plus the client methods in this feature's own
 *    `api.ts` — the 7 `/findings/{findingId}/...` operations of
 *    `specs/005-audit-findings/contracts/audit.openapi.yaml`
 *    (`start-remediation`, `controls` x3, `risks` x3). These are
 *    Finding-scoped, not Audit-scoped: the URL root of every one of them is
 *    `/findings/{findingId}`, not `/audits/{auditId}`, so — following the
 *    same URL-root-owns-the-client rule `features/controls/api.ts` already
 *    applies to `GET /controls/{controlId}/risks` (Control is the URL root
 *    even though `RiskControlLink` is created from the Risk side) — they are
 *    added here rather than to `features/audit-engagements/`. See
 *    `features/audit-engagements/types.ts`'s own header for the mirror of
 *    this same decision from that module's side.
 *
 * `FindingSummary` below is this file's own local, minimal copy of
 * `audit.openapi.yaml`'s `FindingSummary` schema (the `start-remediation`
 * response) — a second, independent copy of the same shape also declared in
 * `features/audit-engagements/types.ts`, by design: the contract itself
 * duplicates rather than cross-references between its documents (see that
 * file's own header comment).
 */
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@/lib/messages/findings';
import type { GrcFoundation } from '@pharos/api-types';

export type { FindingCategory, FindingOrigin, FindingPriority, FindingSeverity, FindingStatus };

/** `GrcFoundation.components['schemas']['OrgUnitRef']` — `{id, name}`, contract-backed (assurance-audit Fix 3). */
export type OrgUnitRef = GrcFoundation.components['schemas']['OrgUnitRef'];

/** `GrcFoundation.components['schemas']['UserRef']` — `{id, fullName}`, contract-backed. */
export type UserRef = GrcFoundation.components['schemas']['UserRef'];

/** Mirrors `Finding` (contracts/grc-foundation.openapi.yaml). */
export interface Finding {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRef;
  readonly title: string;
  readonly description: string;
  readonly recommendation: string | null;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly owner: UserRef;
  readonly identifiedOn: string;
  readonly status: FindingStatus;
  readonly openActionCount: number;
  readonly evidenceCount: number;
  readonly closedAt: string | null;
  readonly closureJustification: string | null;
  /**
   * 005-audit-findings. Null for a finding recorded manually (`POST
   * /findings`); set, and never changeable afterward, for one produced by
   * `POST /audits/{auditId}/findings` (SC-001).
   */
  readonly auditEngagementId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrors `CreateFindingRequest`. */
export interface CreateFindingRequest {
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string;
  readonly recommendation?: string;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly ownerUserId: string;
  readonly identifiedOn: string;
}

/** Mirrors `UpdateFindingRequest` — deliberately no `status` (its own
 * dedicated operations exist precisely so a generic update cannot reach
 * it, C5). */
export interface UpdateFindingRequest {
  readonly title?: string;
  readonly description?: string;
  readonly recommendation?: string | null;
  readonly category?: FindingCategory;
  readonly severity?: FindingSeverity;
  readonly priority?: FindingPriority;
  readonly ownerUserId?: string;
}

/** Mirrors `CloseFindingRequest`. */
export interface CloseFindingRequest {
  readonly justification?: string;
}

/** Mirrors `ReopenFindingRequest`. */
export interface ReopenFindingRequest {
  readonly reason: string;
}

/** Mirrors `FindingPage`. */
export interface FindingPage {
  readonly items: readonly Finding[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

// -------------------------------------------------------------------
// 005-audit-findings additions — see this file's own header comment for
// why these live here rather than in `features/audit-engagements/`.
// -------------------------------------------------------------------

/**
 * Mirrors `FindingSummary` (audit.openapi.yaml) — the `start-remediation`
 * response shape. NOT the same type as `Finding` above: a purpose-fit
 * projection, missing `openActionCount`/`evidenceCount`/`closedAt`/... —
 * typing it as `Finding` would be the same "type lie" class of defect the
 * `OrgUnitRef` header comment above already documents (assurance-audit
 * Fix 3), so this is declared as its own, narrower interface instead.
 */
export interface FindingSummary {
  readonly id: string;
  readonly code: string;
  title: string;
  description?: string;
  readonly category: FindingCategory;
  readonly origin: FindingOrigin;
  readonly severity: FindingSeverity;
  readonly priority: FindingPriority;
  readonly owner: UserRef;
  readonly status: FindingStatus;
  readonly auditEngagementId: string | null;
  identifiedOn: string;
  readonly createdAt: string;
}

/** Mirrors `ControlRef` (audit.openapi.yaml, ADR-020 part 4) — the minimal, read-only projection of a `Control` this API ever shows. */
export interface ControlRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/** Mirrors `RiskRef` (audit.openapi.yaml, ADR-020 part 4). */
export interface RiskRef {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

/** Mirrors `FindingControlLink` (audit.openapi.yaml, US3, ADR-008) — `GET/POST /findings/{findingId}/controls`. Withdrawing stamps `unlinkedAt`/`unlinkedBy`; the row is preserved, never deleted (FR-016). */
export interface FindingControlLink {
  readonly id: string;
  readonly control: ControlRef;
  readonly linkedAt: string;
  readonly linkedBy: UserRef;
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: UserRef | null;
}

/** Mirrors `FindingRiskLink` (audit.openapi.yaml, US3, ADR-008) — `GET/POST /findings/{findingId}/risks`. Same shape and preservation rule as `FindingControlLink` above. */
export interface FindingRiskLink {
  readonly id: string;
  readonly risk: RiskRef;
  readonly linkedAt: string;
  readonly linkedBy: UserRef;
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: UserRef | null;
}

/** Mirrors `CreateFindingControlLinkRequest`. */
export interface CreateFindingControlLinkRequest {
  readonly controlId: string;
}

/** Mirrors `CreateFindingRiskLinkRequest`. */
export interface CreateFindingRiskLinkRequest {
  readonly riskId: string;
}
