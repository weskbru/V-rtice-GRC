/**
 * T126 — port for reading and publishing `RiskMethodologyVersion` rows.
 * `MethodologyQueryUseCase`/`PublishMethodologyVersionUseCase` depend on
 * this abstract class, never on `PrismaService` directly (ADR-011).
 *
 * `modules/risk/infrastructure/risk-methodology.repository.ts` is the only
 * implementation, wired in `risk.module.ts`.
 */
import type { UserRefRecord } from './risk-repository.port';
import type { MethodologyConfiguration } from '../methodology.schema';

/** One methodology version, with its JSONB columns already parsed into the
 * typed shape `RiskScoringService`/`methodology.schema.ts` consume — the
 * repository is the boundary where a stored `Json` value becomes this
 * typed record (trusted, because `validateMethodologyConfiguration` proved
 * the shape before this row was ever written). */
export interface MethodologyVersionRecord extends MethodologyConfiguration {
  readonly id: string;
  readonly methodologyId: string;
  readonly methodologyName: string;
  readonly versionNumber: number;
  readonly effectiveFrom: Date;
  readonly createdBy: UserRefRecord;
}

export interface CreateMethodologyVersionRecordInput {
  readonly methodologyId: string;
  readonly probabilityScale: MethodologyConfiguration['probabilityScale'];
  readonly impactScale: MethodologyConfiguration['impactScale'];
  readonly matrix: MethodologyConfiguration['matrix'];
  readonly levelBands: MethodologyConfiguration['levelBands'];
  readonly effectiveFrom: Date;
  readonly createdByUserId: string;
}

export interface MethodologyVersionPage {
  readonly items: readonly MethodologyVersionRecord[];
  readonly total: number;
}

export abstract class RiskMethodologyRepositoryPort {
  /** The id of the single methodology row with `isActive = true`, or
   * `undefined` when none is configured yet (the seed, T123, guarantees one
   * exists in every environment that has run it). */
  abstract findActiveMethodologyId(): Promise<string | undefined>;

  /**
   * The version currently in force for the active methodology: the row
   * with the greatest `effectiveFrom` that is `<= now()`, tie-broken by the
   * greatest `versionNumber`. `undefined` when there is no active
   * methodology, or the active methodology has no version yet effective
   * (never true once the seed has run, since the seeded version's
   * `effectiveFrom` is never in the future).
   */
  abstract findActiveVersion(): Promise<MethodologyVersionRecord | undefined>;

  abstract findVersionById(id: string): Promise<MethodologyVersionRecord | undefined>;

  abstract listVersions(page: number, pageSize: number): Promise<MethodologyVersionPage>;

  /** Publishes a new version under `input.methodologyId`, allocating the
   * next `versionNumber` for that methodology (FR-068: append-only —
   * always an INSERT, never an UPDATE of an existing row). */
  abstract createVersion(
    input: CreateMethodologyVersionRecordInput,
  ): Promise<MethodologyVersionRecord>;
}
