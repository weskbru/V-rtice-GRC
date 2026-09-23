import { AuditEntityType } from '@prisma/client';

import { registerAuditFieldAllowlist } from '../../../core/audit/domain/audit-field-allowlist';

let registered = false;

export function registerComplianceAuditAllowlists(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerAuditFieldAllowlist(AuditEntityType.FRAMEWORK, ['name', 'description', 'origin']);

  registerAuditFieldAllowlist(AuditEntityType.FRAMEWORK_VERSION, [
    'label',
    'status',
    'publishedAt',
    'publishedByUserId',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT, ['externalRef', 'title', 'description']);

  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT_CONTROL_LINK, [
    'requirementId',
    'controlId',
    'linkedAt',
    'unlinkedAt',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT_CONTROL_MAPPING_MIGRATION, [
    'frameworkId',
    'sourceFrameworkVersionId',
    'targetFrameworkVersionId',
    'copiedCount',
    'pendingDecisionCount',
    'skippedAlreadyMappedCount',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT_APPLICABILITY, [
    'requirementId',
    'justification',
    'declaredAt',
    'revokedAt',
  ]);

  registerAuditFieldAllowlist(AuditEntityType.REQUIREMENT_COMPLIANCE_STATE, [
    'requirementId',
    'previousState',
    'newState',
    'observedAt',
  ]);
}

export function __resetComplianceAuditAllowlistRegistrationForTests(): void {
  registered = false;
}
