/**
 * PharosGRC frontend — Evidence types (T036, 002-shared-grc-foundation, US1).
 *
 * The entity/request interfaces below remain hand-written against
 * `specs/002-shared-grc-foundation/contracts/grc-foundation.openapi.yaml`
 * (revised: no `fileId` — see that document's own revision note): the
 * contract's own `required` arrays under-declare several fields the real
 * API always returns (`description`, `linkCount`, `updatedAt`, …), so
 * `openapi-typescript`'s generated `Evidence` types those `?`-optional —
 * adopting it wholesale would inject spurious `| undefined` through every
 * consumer for no real safety gain (assurance-audit Fix 3's own
 * "half-migrate" warning: reported here rather than done silently).
 *
 * `OrgUnitRef`/`UserRef` below are DIFFERENT — the contract's own
 * `required` list is exactly `id`+`name` / `id`+`fullName`, with no
 * optionality gap — so these two now come from the generated
 * `@pharos/api-types` `GrcFoundation` namespace instead of being
 * hand-declared a third time (`features/actions/types.ts` already
 * hand-declared its own identical `{id, name}` OrgUnitRef; both moved
 * here). This directly closes the bug the audit found: `evidence/types.ts`
 * and `findings/types.ts` used to import RISKS-domain `OrgUnitRef`
 * (`risks.openapi.yaml`, which additionally REQUIRES `code`) for a shape
 * this API never actually returns — nothing read `.code` yet, so it never
 * fired, but nothing stopped it either.
 *
 * Enum unions (`EvidenceType`/`EvidenceSource`/`EvidenceStatus`) still live
 * in `lib/messages/evidence.ts`, NOT the generated schema — that file's
 * `satisfies Record<EvidenceType, string>` is what makes a new enum value
 * missing its pt-BR label a compile error (F-1, `docs/deferred-findings.md`);
 * switching the union's source would only lose that guarantee for a
 * value set that is already provably identical to the generated one.
 */
import type { EvidenceSource, EvidenceStatus, EvidenceType } from '@/lib/messages/evidence';
import type { GrcFoundation } from '@pharos/api-types';

export type { EvidenceSource, EvidenceStatus, EvidenceType };

/** `GrcFoundation.components['schemas']['OrgUnitRef']` — `{id, name}`, contract-backed (assurance-audit Fix 3). */
export type OrgUnitRef = GrcFoundation.components['schemas']['OrgUnitRef'];

/** `GrcFoundation.components['schemas']['UserRef']` — `{id, fullName}`, contract-backed. */
export type UserRef = GrcFoundation.components['schemas']['UserRef'];

/**
 * Mirrors `EvidenceSubjectType` (contracts/grc-foundation.openapi.yaml).
 * `CONTROL` was added by 003-controls-management (FR-026, data-model.md
 * §7): a control's own execution evidence, via the same closed-type
 * registration every other subject already uses. `INCIDENT`/`PROBLEM`
 * were added to the Prisma enum and their accessors registered by
 * 008-incidents-problems (spec.md FR-017), but never added here — the
 * capability existed in the domain with no way to reach it from any
 * screen (CLAUDE.md §19.10).
 */
export type EvidenceSubjectType =
  'RISK' | 'RISK_TREATMENT_DECISION' | 'FINDING' | 'ACTION' | 'CONTROL' | 'INCIDENT' | 'PROBLEM';

/** Mirrors `Evidence` (revised: no `fileId`). */
export interface Evidence {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRef;
  readonly title: string;
  readonly description: string | null;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly owner: UserRef;
  readonly collectedOn: string;
  readonly validUntil: string | null;
  readonly status: EvidenceStatus;
  readonly expired: boolean;
  readonly externalUrl: string | null;
  readonly observation: string | null;
  readonly linkCount: number;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrors `EvidenceLink`. */
export interface EvidenceLink {
  readonly id: string;
  readonly evidenceId: string;
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly subjectLabel?: string;
  readonly note: string | null;
  readonly linkedAt: string;
  readonly linkedBy: UserRef;
  readonly unlinkedAt: string | null;
  readonly unlinkedBy: UserRef | null;
}

/** Mirrors `CreateEvidenceRequest` (revised: no `fileId`). */
export interface CreateEvidenceRequest {
  readonly orgUnitId: string;
  readonly title: string;
  readonly description?: string;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly ownerUserId: string;
  readonly collectedOn: string;
  readonly validUntil?: string;
  readonly externalUrl?: string;
  readonly observation?: string;
}

/** Mirrors `UpdateEvidenceRequest`. */
export interface UpdateEvidenceRequest {
  readonly title?: string;
  readonly description?: string;
  readonly type?: EvidenceType;
  readonly source?: EvidenceSource;
  readonly ownerUserId?: string;
  readonly collectedOn?: string;
  readonly validUntil?: string | null;
  readonly externalUrl?: string | null;
  readonly observation?: string | null;
}

/** Mirrors `LinkEvidenceRequest`. */
export interface LinkEvidenceRequest {
  readonly subjectType: EvidenceSubjectType;
  readonly subjectId: string;
  readonly note?: string;
}

/** Mirrors `EvidencePage`. */
export interface EvidencePage {
  readonly items: readonly Evidence[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}
