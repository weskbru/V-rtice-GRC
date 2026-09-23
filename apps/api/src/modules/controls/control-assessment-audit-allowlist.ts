import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerControlAssessmentAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.CONTROL_ASSESSMENT, [
    'controlId',
    'assessedOn',
    'result',
    'conclusion',
    'approvalId',
    'attestedAt',
    'attestedByUserId',
    'justification',
    'violatedRules',
    'previousEffectiveness',
    'newEffectiveness',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.CONTROL_PROCESS_LINK, [
    'controlId',
    'processId',
    'unlinkedAt',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.CONTROL_ASSET_LINK, [
    'controlId',
    'assetId',
    'unlinkedAt',
  ]);
}

export function __resetControlAssessmentAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
