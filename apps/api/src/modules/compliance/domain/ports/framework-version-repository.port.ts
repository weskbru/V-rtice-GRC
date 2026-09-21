/**
 * T022/004-compliance-management — port for persisting and reading
 * `FrameworkVersion` records (contract operations 5-9). Mirrors
 * `framework-repository.port.ts`'s own conventions; no `ScopeFilter`
 * anywhere (research.md D-2).
 */
import type { FrameworkVersionStatus } from '@prisma/client';

export interface FrameworkVersionFrameworkRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface FrameworkVersionUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

/** One `FrameworkVersion`, exactly as the presentation layer's mapper
 * needs it — every relation already resolved, mirroring `ControlRecord`'s
 * convention. */
export interface FrameworkVersionRecord {
  readonly id: string;
  readonly framework: FrameworkVersionFrameworkRef;
  readonly label: string;
  readonly status: FrameworkVersionStatus;
  readonly publishedAt: Date | undefined;
  readonly publishedBy: FrameworkVersionUserRef | undefined;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateFrameworkVersionInput {
  readonly frameworkId: string;
  readonly label: string;
}

/** `undefined` = leave unchanged. */
export interface UpdateFrameworkVersionChanges {
  readonly label?: string;
}

export interface PublishFrameworkVersionChanges {
  readonly publishedAt: Date;
  readonly publishedByUserId: string;
}

export type FrameworkVersionUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly record: FrameworkVersionRecord }
  | { readonly outcome: 'NOT_FOUND' }
  | {
      readonly outcome: 'VERSION_CONFLICT';
      readonly currentVersion: number;
      readonly currentStatus: FrameworkVersionStatus;
    };

export interface FrameworkVersionListQuery {
  readonly frameworkId: string;
  readonly page: number;
  readonly pageSize: number;
  readonly status?: readonly FrameworkVersionStatus[] | undefined;
}

export interface FrameworkVersionListPage {
  readonly items: readonly FrameworkVersionRecord[];
  readonly total: number;
}

export abstract class FrameworkVersionRepositoryPort {
  abstract create(input: CreateFrameworkVersionInput): Promise<FrameworkVersionRecord>;

  /** `undefined` when no version with this id exists at all — the caller
   * is responsible for confirming it belongs to the expected
   * `frameworkId` (mirrors how nested-resource use cases elsewhere in this
   * codebase compose two single-entity lookups rather than a single
   * combined query, so each repository method stays a single-purpose,
   * independently testable read). */
  abstract findById(id: string): Promise<FrameworkVersionRecord | undefined>;

  /** For the uniqueness pre-check (FR-002: "label deve ser único dentro do
   * framework") on create/rename. `excludeVersionId` lets `update` check
   * "does another version of this framework already have this label"
   * without matching the version being renamed to its own current
   * label. */
  abstract findByFrameworkAndLabel(
    frameworkId: string,
    label: string,
    excludeVersionId?: string,
  ): Promise<{ readonly id: string } | undefined>;

  abstract list(query: FrameworkVersionListQuery): Promise<FrameworkVersionListPage>;

  /** The number of `Requirement` rows belonging to this version — the
   * publish precondition (FR-005: a version with none is refused). */
  abstract countRequirements(versionId: string): Promise<number>;

  abstract updateLabelWithVersion(
    id: string,
    expectedVersion: number,
    changes: UpdateFrameworkVersionChanges,
  ): Promise<FrameworkVersionUpdateResult>;

  /** The `DRAFT -> PUBLISHED` write (research.md D-3) — a disjoint field
   * set from `updateLabelWithVersion`, the same "one conditional UPDATE per
   * write shape" convention `ControlRepository.updateWithVersion`/
   * `.applyLifecycleTransition` establish as two separate methods rather
   * than one that accepts every possible field. */
  abstract publishWithVersion(
    id: string,
    expectedVersion: number,
    changes: PublishFrameworkVersionChanges,
  ): Promise<FrameworkVersionUpdateResult>;
}
