import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerRiskAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.RISK, [
    'title',
    'description',
    'categoryId',
    'typeId',
    'originId',
    'orgUnitId',
    'ownerUserId',
    'responsibleUserId',
    'identifiedOn',
    'nextReviewOn',
    'causes',
    'consequences',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.RISK_ASSESSMENT, [
    'riskId',
    'methodologyVersionId',
    'assessedOn',
    'inherentProbability',
    'inherentImpact',
    'inherentScore',
    'inherentLevel',
    'residualProbability',
    'residualImpact',
    'residualScore',
    'residualLevel',
    'controlsConsidered',
    'previousAssessmentId',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.RISK_METHODOLOGY_VERSION, [
    'methodologyId',
    'versionNumber',
    'effectiveFrom',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.RISK_TREATMENT_DECISION, [
    'riskId',
    'strategy',
    'description',
    'deadline',
    'previousTreatmentDecisionId',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.RISK_TREATMENT_ACTION, [
    'riskId',
    'treatmentDecisionId',
    'title',
    'description',
    'responsibleUserId',
    'dueOn',
    'status',
    'completedAt',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.RISK_CONTROL_LINK, [
    'riskId',
    'controlId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.RISK_PROCESS_LINK, [
    'riskId',
    'processId',
    'unlinkedAt',
  ]);
  registerAuditFieldAllowlist(AuditEntityType.RISK_ASSET_LINK, ['riskId', 'assetId', 'unlinkedAt']);

  registerAuditFieldAllowlist(AuditEntityType.RISK_LIFECYCLE_TRANSITION, [
    'riskId',
    'fromStatus',
    'toStatus',
    'justification',
    'approvalId',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.APPROVAL, [
    'riskId',
    'requestedTransition',
    'decision',
    'toStatus',
    'justification',
  ]);
}
