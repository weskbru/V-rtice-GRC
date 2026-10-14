import type { ControlUserRef } from './control-assessment-repository.port';
import type { ApprovableEntityType, ApprovalStatus } from '@prisma/client';

export interface ControlAssessmentApprovalRecord {
  readonly id: string;
  readonly entityType: ApprovableEntityType;
  readonly entityId: string;
  readonly requestedBy: ControlUserRef;
  readonly requestedAt: Date;
  readonly status: ApprovalStatus;
  readonly decidedBy: ControlUserRef | undefined;
  readonly decidedAt: Date | undefined;
  readonly justification: string | undefined;
}

export interface CreateControlAssessmentApprovalInput {
  readonly entityId: string;
  readonly requestedByUserId: string;
  readonly justification: string | null;
}

export interface DecideControlAssessmentApprovalInput {
  readonly id: string;
  readonly decidedByUserId: string;
  readonly status: Exclude<ApprovalStatus, 'PENDING'>;
  readonly justification: string | null;
}

export abstract class ControlAssessmentApprovalRepositoryPort {
  abstract create(
    input: CreateControlAssessmentApprovalInput,
  ): Promise<ControlAssessmentApprovalRecord>;

  abstract findPendingByEntityId(
    assessmentId: string,
  ): Promise<ControlAssessmentApprovalRecord | undefined>;

  abstract findById(id: string): Promise<ControlAssessmentApprovalRecord | undefined>;

  abstract listByEntityId(
    assessmentId: string,
  ): Promise<readonly ControlAssessmentApprovalRecord[]>;

  abstract decide(
    input: DecideControlAssessmentApprovalInput,
  ): Promise<ControlAssessmentApprovalRecord>;
}
