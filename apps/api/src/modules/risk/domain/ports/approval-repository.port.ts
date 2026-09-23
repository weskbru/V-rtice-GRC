import type { UserRefRecord } from './risk-repository.port';
import type { ApprovableEntityType, ApprovalStatus } from '@prisma/client';

export interface ApprovalRecord {
  readonly id: string;
  readonly entityType: ApprovableEntityType;
  readonly entityId: string;
  readonly requestedTransition: string;
  readonly requestedBy: UserRefRecord;
  readonly requestedAt: Date;
  readonly status: ApprovalStatus;
  readonly decidedBy: UserRefRecord | null;
  readonly decidedAt: Date | null;
  readonly justification: string | null;
}

export interface CreateApprovalInput {
  readonly entityType: ApprovableEntityType;
  readonly entityId: string;
  readonly requestedTransition: string;
  readonly requestedByUserId: string;
  readonly justification: string | null;
}

export interface DecideApprovalInput {
  readonly id: string;
  readonly decidedByUserId: string;
  readonly status: Exclude<ApprovalStatus, 'PENDING'>;
  readonly justification: string | null;
}

export abstract class ApprovalRepositoryPort {
  abstract create(input: CreateApprovalInput): Promise<ApprovalRecord>;

  abstract findById(id: string): Promise<ApprovalRecord | undefined>;

  abstract findPendingByEntity(
    entityType: ApprovableEntityType,
    entityId: string,
  ): Promise<ApprovalRecord | undefined>;

  abstract listByEntity(
    entityType: ApprovableEntityType,
    entityId: string,
  ): Promise<readonly ApprovalRecord[]>;

  abstract decide(input: DecideApprovalInput): Promise<ApprovalRecord>;
}
