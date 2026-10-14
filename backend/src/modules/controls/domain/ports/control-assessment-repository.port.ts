import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { ControlAssessmentForEffectiveness } from '../control-effectiveness.service';
import type { ControlAssessmentResult } from '@prisma/client';

export interface ControlUserRef {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface ControlAssessmentRecord {
  readonly id: string;
  readonly controlId: string;
  readonly assessedOn: Date;
  readonly assessor: ControlUserRef;
  readonly result: ControlAssessmentResult;
  readonly conclusion: string;
  readonly approvalId: string | undefined;
  readonly attestedAt: Date | undefined;
  readonly attestedByUserId: string | undefined;
  readonly createdAt: Date;
}

export interface CreateControlAssessmentInput {
  readonly controlId: string;
  readonly assessedOn: Date;
  readonly assessorUserId: string;
  readonly result: ControlAssessmentResult;
  readonly conclusion: string;
}

export interface ControlAssessmentOriginLookup {
  readonly assessmentId: string;
  readonly controlId: string;
  readonly controlOrgUnitId: string;
  readonly controlCode: string;
  readonly assessedOn: Date;
}

export abstract class ControlAssessmentRepositoryPort {
  abstract create(input: CreateControlAssessmentInput): Promise<ControlAssessmentRecord>;

  abstract findById(controlId: string, id: string): Promise<ControlAssessmentRecord | undefined>;

  abstract listByControl(
    controlId: string,
    page: number,
    pageSize: number,
  ): Promise<{ readonly items: readonly ControlAssessmentRecord[]; readonly total: number }>;

  abstract listAllForEffectiveness(
    controlId: string,
  ): Promise<readonly ControlAssessmentForEffectiveness[]>;

  abstract setApprovalId(id: string, approvalId: string): Promise<void>;

  abstract attest(id: string, attestedAt: Date, attestedByUserId: string): Promise<void>;

  abstract findForOrigin(assessmentId: string): Promise<ControlAssessmentOriginLookup | undefined>;

  abstract listAssessmentIdsInScope(scope: ScopeFilter): Promise<readonly string[]>;
}
