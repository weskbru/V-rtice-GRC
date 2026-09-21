/**
 * T028/002-shared-grc-foundation, US1 — `EvidenceRepositoryPort`
 * (data-model.md §2, ADR-004, ADR-011). `grc/evidence/application/**`
 * depends on this abstract class, never on `PrismaService` directly.
 * `grc/evidence/infrastructure/prisma-evidence.repository.ts` is the sole
 * implementation.
 *
 * Unlike `Risk`, `Evidence` carries no `version` column (data-model.md §2
 * declares no optimistic-concurrency field for it) — there is no
 * `If-Match`/`expectedVersion` shape here, and no conditional-update
 * mechanism to mirror `RiskRepositoryPort.updateWithVersion`.
 */
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  EvidenceSource,
  EvidenceStatus,
  EvidenceSubjectType,
  EvidenceType,
} from '@prisma/client';

export interface OrgUnitRefRecord {
  readonly id: string;
  readonly name: string;
}

export interface UserRefRecord {
  readonly id: string;
  readonly fullName: string;
}

/** The full wire-shape record `EvidenceResponseMapper` consumes. */
export interface EvidenceRecord {
  readonly id: string;
  readonly code: string;
  readonly orgUnit: OrgUnitRefRecord;
  readonly title: string;
  readonly description: string | undefined;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly owner: UserRefRecord;
  readonly collectedOn: Date;
  readonly validUntil: Date | undefined;
  readonly status: EvidenceStatus;
  readonly externalUrl: string | undefined;
  readonly observation: string | undefined;
  readonly archivedAt: Date | undefined;
  readonly archivedByUserId: string | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateEvidenceRecordInput {
  readonly code: string;
  readonly orgUnitId: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly type: EvidenceType;
  readonly source: EvidenceSource;
  readonly ownerUserId: string;
  readonly collectedOn: Date;
  readonly validUntil: Date | undefined;
  readonly externalUrl: string | undefined;
  readonly observation: string | undefined;
}

/** `undefined` means "leave unchanged"; `null` (where accepted, i.e. the
 * nullable fields) means "clear this field" — the same convention
 * `UpdateRiskChanges` establishes, matching `UpdateEvidenceRequest`'s own
 * `PATCH`-merge semantics (contracts/grc-foundation.openapi.yaml). */
export interface UpdateEvidenceChanges {
  readonly title?: string;
  readonly description?: string | null;
  readonly type?: EvidenceType;
  readonly source?: EvidenceSource;
  readonly ownerUserId?: string;
  readonly collectedOn?: Date;
  readonly validUntil?: Date | null;
  readonly externalUrl?: string | null;
  readonly observation?: string | null;
}

export interface EvidenceListFilter {
  readonly status?: EvidenceStatus | undefined;
  readonly type?: EvidenceType | undefined;
  readonly ownerUserId?: string | undefined;
  readonly orgUnitId?: string | undefined;
  /** `Evidence` whose `validUntil` falls before this date (SC-010's expiry
   * view). `undefined` means no filter on `validUntil` at all. */
  readonly expiringBefore?: Date | undefined;
  readonly search?: string | undefined;
  /**
   * Restricts the listing to evidence with a currently-ACTIVE link to this
   * exact subject (`subjectType`/`subjectId`) — the "evidence panel on a
   * domain screen" read path SC-001 requires ("vincula um risco ... sem
   * sair do contexto do risco"). Both or neither: the use case
   * (`ListEvidenceUseCase`) validates this pairing and resolves the
   * subject's own visibility BEFORE this filter ever reaches the
   * repository — see that file's header for why disclosing "evidence
   * exists for subject X" must not become a side channel around
   * `EvidenceSubjectResolverPort`.
   */
  readonly subjectType?: EvidenceSubjectType | undefined;
  readonly subjectId?: string | undefined;
}

export interface EvidencePageResult {
  readonly items: readonly EvidenceRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export abstract class EvidenceRepositoryPort {
  abstract create(input: CreateEvidenceRecordInput): Promise<EvidenceRecord>;

  /** Scoped single-row read (ADR-004) — the SAME predicate every other
   * method here applies, so an evidence outside `scope` is indistinguishable
   * from one that does not exist (`undefined` either way, FR-030/FR-032). */
  abstract findById(scope: ScopeFilter, id: string): Promise<EvidenceRecord | undefined>;

  /**
   * F-38 — an UNSCOPED lookup of `id`'s CURRENT `orgUnitId`, ignoring
   * `scope` entirely. `undefined` only when no evidence with this id
   * exists at all. Used EXCLUSIVELY on the refusal path, after `findById`/
   * `update`/`archive` has already returned nothing, so
   * `OrgScopeEnforcerService.assertExistingRecordAccessible` can tell
   * "does not exist" (no audit) apart from "exists outside scope"
   * (audited). NEVER for building a caller-visible response.
   */
  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  /** Scoped conditional update. Returns `undefined` when `id` is outside
   * `scope` or does not exist — the caller (`UpdateEvidenceUseCase`) is
   * responsible for turning that into `NotFoundDomainError`. */
  abstract update(
    scope: ScopeFilter,
    id: string,
    changes: UpdateEvidenceChanges,
  ): Promise<EvidenceRecord | undefined>;

  /** Scoped archival (FR-009) — sets `status = ARCHIVED`,
   * `archivedAt`/`archivedByUserId`. Never a physical delete. Returns
   * `undefined` under the same out-of-scope/not-found rule as `update`. */
  abstract archive(
    scope: ScopeFilter,
    id: string,
    archivedByUserId: string,
    archivedAt: Date,
  ): Promise<EvidenceRecord | undefined>;

  abstract list(
    scope: ScopeFilter,
    filter: EvidenceListFilter,
    page: number,
    pageSize: number,
  ): Promise<EvidencePageResult>;
}
