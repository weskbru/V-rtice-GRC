import type { UserRefResponse } from './risk-response.mapper';
import type { ApprovalRecord } from '../../domain/ports/approval-repository.port';
import type { ApprovalStatus } from '@prisma/client';

export interface ApprovalResponse {
  readonly id: string;
  readonly requestedTransition: string;
  readonly requestedBy: UserRefResponse;
  readonly requestedAt: string;
  readonly status: ApprovalStatus;
  readonly decidedBy: UserRefResponse | null;
  readonly decidedAt: string | null;
  readonly justification: string | null;
}

export function toApprovalResponse(record: ApprovalRecord): ApprovalResponse {
  return {
    id: record.id,
    requestedTransition: record.requestedTransition,
    requestedBy: {
      id: record.requestedBy.id,
      fullName: record.requestedBy.fullName,
      email: record.requestedBy.email,
    },
    requestedAt: record.requestedAt.toISOString(),
    status: record.status,
    decidedBy: record.decidedBy
      ? {
          id: record.decidedBy.id,
          fullName: record.decidedBy.fullName,
          email: record.decidedBy.email,
        }
      : null,
    decidedAt: record.decidedAt ? record.decidedAt.toISOString() : null,
    justification: record.justification,
  };
}
