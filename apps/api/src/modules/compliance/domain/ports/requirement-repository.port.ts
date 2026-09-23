import type { RequirementComplianceState, FrameworkVersionStatus } from '@prisma/client';

export interface RequirementFrameworkVersionRef {
  readonly id: string;
  readonly label: string;
  readonly status: FrameworkVersionStatus;
}

export interface RequirementUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface RequirementApplicabilityRef {
  readonly id: string;
  readonly justification: string;
  readonly declaredBy: RequirementUserRef;
  readonly declaredAt: Date;
}

export interface RequirementRecord {
  readonly id: string;
  readonly frameworkVersion: RequirementFrameworkVersionRef;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly applicability: RequirementApplicabilityRef | undefined;
  readonly complianceState: RequirementComplianceState;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RequirementRow {
  readonly id: string;
  readonly frameworkVersion: RequirementFrameworkVersionRef;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateRequirementInput {
  readonly frameworkVersionId: string;
  readonly externalRef: string;
  readonly title: string;
  readonly description: string;
  readonly createdByUserId: string;
}

export interface UpdateRequirementChanges {
  readonly externalRef?: string;
  readonly title?: string;
  readonly description?: string;
}

export type RequirementUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly row: RequirementRow }
  | { readonly outcome: 'NOT_FOUND' }
  | { readonly outcome: 'VERSION_CONFLICT'; readonly currentVersion: number };

export interface RequirementListPage {
  readonly items: readonly RequirementRow[];
  readonly total: number;
}

export abstract class RequirementRepositoryPort {
  abstract create(input: CreateRequirementInput): Promise<RequirementRow>;

  abstract findById(id: string): Promise<RequirementRow | undefined>;

  abstract list(
    frameworkVersionId: string,
    page: number,
    pageSize: number,
  ): Promise<RequirementListPage>;

  abstract findAllByFrameworkVersion(
    frameworkVersionId: string,
  ): Promise<readonly RequirementRow[]>;

  abstract updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: UpdateRequirementChanges,
  ): Promise<RequirementUpdateResult>;

  abstract findActiveApplicability(
    requirementId: string,
  ): Promise<RequirementApplicabilityRef | undefined>;

  abstract findActiveApplicabilityMany(
    requirementIds: readonly string[],
  ): Promise<ReadonlyMap<string, RequirementApplicabilityRef>>;

  abstract findActiveLinkedControlIds(requirementId: string): Promise<readonly string[]>;

  abstract findActiveLinkedControlIdsMany(
    requirementIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
