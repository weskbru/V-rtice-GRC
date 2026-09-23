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

  abstract findById(id: string): Promise<FrameworkVersionRecord | undefined>;

  abstract findByFrameworkAndLabel(
    frameworkId: string,
    label: string,
    excludeVersionId?: string,
  ): Promise<{ readonly id: string } | undefined>;

  abstract list(query: FrameworkVersionListQuery): Promise<FrameworkVersionListPage>;

  abstract countRequirements(versionId: string): Promise<number>;

  abstract updateLabelWithVersion(
    id: string,
    expectedVersion: number,
    changes: UpdateFrameworkVersionChanges,
  ): Promise<FrameworkVersionUpdateResult>;

  abstract publishWithVersion(
    id: string,
    expectedVersion: number,
    changes: PublishFrameworkVersionChanges,
  ): Promise<FrameworkVersionUpdateResult>;
}
