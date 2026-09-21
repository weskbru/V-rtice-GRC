/**
 * T032/004-compliance-management, User Story 2 — port for
 * `RequirementControlLink` (data-model.md §4). No `ScopeFilter` anywhere
 * (research.md D-2): the requirement side of this link carries no
 * organizational scope of its own. The referenced CONTROL's scope is
 * checked by the use case, before any write, via `ControlDirectoryPort`
 * (ADR-020 part 4) — this repository never touches `controls` beyond the
 * read-only `include` needed to serve `RequirementControlLinkRecord.control`
 * (the same convention `PrismaRiskControlLinkRepository` already
 * establishes for `RiskControlLink`, see that file's header).
 */
import type { RequirementControlLinkRecord } from '../requirement-control-link.entity';

export abstract class RequirementControlLinkRepositoryPort {
  /** The currently active link (`unlinkedAt IS NULL`) between this
   * requirement and this control, or `undefined` — used both to refuse a
   * duplicate `POST` (409) and, after a withdrawal, to confirm relinking
   * is legal (FR-008). */
  abstract findActiveLink(
    requirementId: string,
    controlId: string,
  ): Promise<RequirementControlLinkRecord | undefined>;

  abstract create(
    requirementId: string,
    controlId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<RequirementControlLinkRecord>;

  /** `undefined` when no link with this id exists under this requirement. */
  abstract findById(
    requirementId: string,
    linkId: string,
  ): Promise<RequirementControlLinkRecord | undefined>;

  /** Stamps `unlinkedAt`/`unlinkedByUserId` — never a physical delete
   * (FR-011). Returns the updated record. */
  abstract unlink(
    linkId: string,
    unlinkedByUserId: string,
    unlinkedAt: Date,
  ): Promise<RequirementControlLinkRecord>;

  /** `includeWithdrawn: false` returns only the currently active links;
   * `true` also returns withdrawn ones, newest first (FR-011). */
  abstract list(
    requirementId: string,
    includeWithdrawn: boolean,
  ): Promise<readonly RequirementControlLinkRecord[]>;

  /**
   * The distinct set of control ids currently linked (`unlinkedAt IS
   * NULL`) to ANY of `requirementIds` — the batch read
   * `ExecuteMappingMigrationUseCase` (T036) needs twice: to know whether a
   * TARGET requirement already has an active link of its own (any
   * non-empty result), and to resolve the union of active links across
   * every listed SOURCE requirement of a correspondence (research.md
   * D-6's "a união dos vínculos vigentes de todas as origens listadas").
   * Grouped per requirement id so both uses can be served from one round
   * trip; a requirement id with no active link is simply absent from the
   * map (never an empty-array entry materialized for it).
   */
  abstract findActiveControlIdsByRequirement(
    requirementIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
