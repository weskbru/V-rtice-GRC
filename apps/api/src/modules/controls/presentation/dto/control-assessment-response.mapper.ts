import type { ControlAssessmentApprovalRecord } from '../../domain/ports/control-assessment-approval-repository.port';
import type { ControlAssessmentRecord } from '../../domain/ports/control-assessment-repository.port';

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface ControlAssessmentAttestationResponse {
  readonly id: string;
  readonly status: 'PENDING' | 'APPROVED' | 'REJECTED';
  readonly requestedBy: UserRefResponse;
  readonly requestedAt: string;
  readonly decidedBy: UserRefResponse | null;
  readonly decidedAt: string | null;
  readonly justification: string | null;
}

export interface ControlAssessmentResponse {
  readonly id: string;
  readonly assessedOn: string;
  readonly assessor: UserRefResponse;
  readonly result: ControlAssessmentRecord['result'];
  readonly conclusion: string;
  readonly attestation: ControlAssessmentAttestationResponse | null;
  readonly createdAt: string;
}

export function toControlAssessmentAttestationResponse(
  approval: ControlAssessmentApprovalRecord,
): ControlAssessmentAttestationResponse {
  return {
    id: approval.id,
    status: approval.status,
    requestedBy: approval.requestedBy,
    requestedAt: approval.requestedAt.toISOString(),
    decidedBy: approval.decidedBy ?? null,
    decidedAt: approval.decidedAt?.toISOString() ?? null,
    justification: approval.justification ?? null,
  };
}

export function toControlAssessmentResponse(
  record: ControlAssessmentRecord,
  attestation: ControlAssessmentApprovalRecord | undefined,
): ControlAssessmentResponse {
  return {
    id: record.id,
    assessedOn: toDateOnlyString(record.assessedOn),
    assessor: record.assessor,
    result: record.result,
    conclusion: record.conclusion,
    attestation: attestation ? toControlAssessmentAttestationResponse(attestation) : null,
    createdAt: record.createdAt.toISOString(),
  };
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
