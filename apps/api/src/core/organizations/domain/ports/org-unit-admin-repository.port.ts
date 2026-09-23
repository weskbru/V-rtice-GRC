import type { OrgUnitStatus } from '@prisma/client';

export interface OrgUnitAdminRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | undefined;
  readonly path: string;
  readonly depth: number;
  readonly status: OrgUnitStatus;
  readonly childCount: number;
}

export interface OrgUnitPathInfoRecord {
  readonly id: string;
  readonly path: string;
  readonly depth: number;
}

export interface CreateOrgUnitRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | undefined;
  readonly path: string;
  readonly depth: number;
}

export interface UpdateOrgUnitFields {
  readonly code?: string;
  readonly name?: string;
}

export interface PreviousOrgUnitFields {
  readonly code: string;
  readonly name: string;
}

export interface ReparentDescendantUpdate {
  readonly id: string;
  readonly path: string;
  readonly depth: number;
}

export interface ApplyReparentInput {
  readonly unitId: string;
  readonly parentId: string | undefined;
  readonly path: string;
  readonly depth: number;
  readonly descendants: readonly ReparentDescendantUpdate[];
}

export abstract class OrgUnitAdminRepositoryPort {
  abstract listAll(status: OrgUnitStatus | undefined): Promise<readonly OrgUnitAdminRecord[]>;

  abstract findById(id: string): Promise<OrgUnitAdminRecord | undefined>;

  abstract findByCode(
    code: string,
    excludeUnitId?: string,
  ): Promise<{ readonly id: string } | undefined>;

  abstract findPathInfoById(id: string): Promise<OrgUnitPathInfoRecord | undefined>;

  abstract findStrictDescendantsPathInfo(path: string): Promise<readonly OrgUnitPathInfoRecord[]>;

  abstract hasActiveDescendant(path: string): Promise<boolean>;

  abstract create(input: CreateOrgUnitRow): Promise<OrgUnitAdminRecord>;

  abstract updateFields(
    id: string,
    patch: UpdateOrgUnitFields,
  ): Promise<PreviousOrgUnitFields | undefined>;

  abstract applyReparent(input: ApplyReparentInput): Promise<void>;

  abstract setStatus(id: string, status: OrgUnitStatus): Promise<OrgUnitStatus | undefined>;
}
