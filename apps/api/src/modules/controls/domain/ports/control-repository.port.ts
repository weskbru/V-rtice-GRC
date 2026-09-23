import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type {
  ControlAssessmentForEffectiveness,
  ControlEffectiveness,
} from '../control-effectiveness.service';
import type { ControlFrequency, ControlNature, ControlStatus, ControlType } from '@prisma/client';

export interface ControlOrgUnitRefRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ControlUserRefRecord {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface ControlRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly orgUnit: ControlOrgUnitRefRecord | null;
  readonly owner: ControlUserRefRecord | undefined;
  readonly nature: ControlNature | undefined;
  readonly type: ControlType | undefined;
  readonly frequency: ControlFrequency | undefined;
  readonly status: ControlStatus;
  readonly effectiveness: ControlEffectiveness;
  readonly retiredAt: Date | undefined;
  readonly retiredBy: ControlUserRefRecord | undefined;
  readonly retirementReason: string | undefined;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateControlRecordInput {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly orgUnitId: string;
  readonly ownerUserId: string | undefined;
  readonly nature: ControlNature | undefined;
  readonly type: ControlType | undefined;
  readonly frequency: ControlFrequency | undefined;
}

export interface UpdateControlChanges {
  readonly name?: string;
  readonly description?: string;
  readonly orgUnitId?: string;
  readonly ownerUserId?: string | null;
  readonly nature?: ControlNature | null;
  readonly type?: ControlType | null;
  readonly frequency?: ControlFrequency | null;
}

export interface ApplyControlTransitionChanges {
  readonly status: ControlStatus;
  readonly isActive: boolean;
  readonly retiredAt?: Date;
  readonly retiredByUserId?: string;
  readonly retirementReason?: string;
}

export type ControlUpdateResult =
  | { readonly outcome: 'UPDATED'; readonly record: ControlRecord }
  | { readonly outcome: 'NOT_FOUND' }
  | {
      readonly outcome: 'VERSION_CONFLICT';
      readonly currentVersion: number;
      readonly currentStatus: ControlStatus;
    };

export abstract class ControlRepositoryPort {
  abstract create(input: CreateControlRecordInput, referenceDate: Date): Promise<ControlRecord>;

  abstract findById(
    scope: ScopeFilter,
    id: string,
    referenceDate: Date,
  ): Promise<ControlRecord | undefined>;

  abstract findOrgUnitIdUnscoped(id: string): Promise<string | undefined>;

  abstract updateWithVersion(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: UpdateControlChanges,
    referenceDate: Date,
  ): Promise<ControlUpdateResult>;

  abstract applyLifecycleTransition(
    scope: ScopeFilter,
    id: string,
    expectedVersion: number,
    changes: ApplyControlTransitionChanges,
    referenceDate: Date,
  ): Promise<ControlUpdateResult>;

  abstract listAssessmentsForEffectiveness(
    controlId: string,
  ): Promise<readonly ControlAssessmentForEffectiveness[]>;
}
