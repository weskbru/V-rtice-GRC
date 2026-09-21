/**
 * PharosGRC frontend — Action types (T056, 002-shared-grc-foundation, US2).
 *
 * The entity/request interfaces below remain hand-written against
 * `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml` —
 * see `features/evidence/types.ts`'s own header comment for why (the
 * contract's `required` arrays under-declare fields the real API always
 * returns). Enum unions (`ActionOriginType`/`ActionStatus`) live in
 * `lib/messages/actions.ts` — imported from there rather than re-declared,
 * the same convention `evidence/types.ts` establishes for
 * `EvidenceType`/`EvidenceSource`.
 */
import type { ActionOriginType, ActionStatus } from '@/lib/messages/actions';
import type { GrcFoundation } from '@pharos/api-types';

export type { ActionOriginType, ActionStatus };

/**
 * `GrcFoundation.components['schemas']['OrgUnitRef']` — `{id, name}` only,
 * UNLIKE `features/risks/types.ts`'s own `OrgUnitRef`, whose
 * `risks.openapi.yaml` schema additionally requires `code` (a shape this
 * API never actually returns — the exact "type lie" the assurance audit
 * found in `evidence/types.ts` and `findings/types.ts`, which had imported
 * that RISKS-domain type). This file's own local `{id, name}` interface
 * predates the 002 contract being wired into `@pharos/api-types`
 * (assurance-audit Fix 3) and correctly avoided that lie from the start —
 * it now reuses the generated schema instead of hand-declaring the same
 * shape a third time.
 */
export type OrgUnitRef = GrcFoundation.components['schemas']['OrgUnitRef'];

/** `GrcFoundation.components['schemas']['UserRef']` — `{id, fullName}`, contract-backed, replacing the RISKS-domain `UserRef` this file used to borrow (safe — a structural superset — but an unnecessary cross-feature dependency now that the real one is generated). */
export type UserRef = GrcFoundation.components['schemas']['UserRef'];

/** Mirrors `Action` (contracts/grc-foundation.openapi.yaml). */
export interface Action {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRef;
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly originLabel?: string;
  readonly title: string;
  readonly description: string | null;
  readonly responsible: UserRef;
  readonly dueOn: string;
  readonly status: ActionStatus;
  readonly overdue: boolean;
  readonly completedAt: string | null;
  readonly reopenedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrors `ActionPage`. */
export interface ActionPage {
  readonly items: readonly Action[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/** Mirrors `CreateActionRequest`. Not used by "Minhas ações" itself (US2's
 * R-009: Action creation happens contextually, from the domain screen it
 * arises from) — kept here so a future domain screen's "criar ação" flow
 * has a ready-made request type, the same way `evidence/types.ts` keeps
 * `CreateEvidenceRequest` for callers beyond the evidence panel itself. */
export interface CreateActionRequest {
  readonly originType: ActionOriginType;
  readonly originId: string;
  readonly title: string;
  readonly description?: string;
  readonly responsibleUserId: string;
  readonly dueOn: string;
}

/** Mirrors `UpdateActionRequest`. */
export interface UpdateActionRequest {
  readonly title?: string;
  readonly description?: string;
  readonly responsibleUserId?: string;
  readonly dueOn?: string;
}

/** Mirrors `TransitionActionRequest`. */
export interface TransitionActionRequest {
  readonly to: ActionStatus;
  /** Required by the server when `to === 'OPEN'` (Invariant A2) — optional
   * here because every OTHER transition legitimately omits it. */
  readonly reason?: string;
}

/** `GET /actions`'s own query parameters this feature uses. */
export interface ListActionsQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly status?: ActionStatus;
  readonly responsibleUserId?: string;
  readonly originType?: ActionOriginType;
  readonly originId?: string;
  readonly overdue?: boolean;
}

/** A page envelope, mirroring `PageMeta` (`features/risks/types.ts`'s own
 * `Page<T>` — each feature module keeps its own copy rather than importing
 * another business module's, per CLAUDE.md §2/§4). */
export interface Page<T> {
  data: readonly T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/** Mirrors `AuditEvent.outcome` (`features/risks/types.ts`'s own identical type — the platform-wide audit-event shape, ADR-007). */
export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED';

/**
 * One immutable audit-trail entry for an `Action`, mirroring `risks
 * .openapi.yaml`'s `AuditEvent` shape exactly — `GET /actions/{actionId}
 * /audit-events` is expected to be the same platform-wide audit endpoint
 * pattern as `GET /risks/{riskId}/audit-events` (T171), just scoped to
 * `Action`. `action`/`entityType` are technical identifiers (CLAUDE.md
 * §11.1) and are never translated for display.
 */
export interface AuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  /** `null` only for a genuine pre-authentication event — `actorLabel` is the recorded display name regardless (so history reads correctly after a rename). */
  readonly actor: UserRef | null;
  readonly actorLabel: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  /** Allow-listed fields only — secrets, credentials and session identifiers are never eligible. */
  readonly previousValues: Record<string, unknown> | null;
  readonly newValues: Record<string, unknown> | null;
  readonly outcome: AuditOutcome;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly correlationId: string;
}
