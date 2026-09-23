import type { AuditEngagementUserRefRecord } from './audit-engagement-repository.port';

export type AuditScopeTargetType = 'FRAMEWORK_VERSION' | 'REQUIREMENT' | 'CONTROL';

export interface AuditScopeTargetRefRecord {
  readonly id: string;
  readonly label: string;
}

export interface AuditScopeEntryRecord {
  readonly id: string;
  readonly targetType: AuditScopeTargetType;
  readonly target: AuditScopeTargetRefRecord;
  readonly linkedAt: Date;
  readonly linkedBy: AuditEngagementUserRefRecord;
}

export abstract class AuditScopeRepositoryPort {
  abstract createFrameworkVersionLink(
    auditEngagementId: string,
    frameworkVersionId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<{ readonly id: string; readonly linkedAt: Date }>;

  abstract createRequirementLink(
    auditEngagementId: string,
    requirementId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<{ readonly id: string; readonly linkedAt: Date }>;

  abstract createControlLink(
    auditEngagementId: string,
    controlId: string,
    linkedByUserId: string,
    linkedAt: Date,
  ): Promise<{ readonly id: string; readonly linkedAt: Date }>;

  abstract hasFrameworkVersionLink(
    auditEngagementId: string,
    frameworkVersionId: string,
  ): Promise<boolean>;

  abstract hasRequirementLink(auditEngagementId: string, requirementId: string): Promise<boolean>;

  abstract hasControlLink(auditEngagementId: string, controlId: string): Promise<boolean>;

  abstract listScope(auditEngagementId: string): Promise<readonly AuditScopeEntryRecord[]>;

  abstract countScopeLinks(auditEngagementId: string): Promise<number>;
}
