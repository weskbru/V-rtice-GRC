import type {
  AuditScopeEntryRecord,
  AuditScopeTargetRefRecord,
  AuditScopeTargetType,
} from '../../domain/ports/audit-scope-repository.port';

export interface AuditScopeTargetRefResponse {
  readonly id: string;
  readonly label: string;
}

export interface AuditScopeEntryResponse {
  readonly id: string;
  readonly targetType: AuditScopeTargetType;
  readonly target: AuditScopeTargetRefResponse;
  readonly linkedAt: string;
  readonly linkedBy: { readonly id: string; readonly fullName: string };
}

function toTargetRefResponse(ref: AuditScopeTargetRefRecord): AuditScopeTargetRefResponse {
  return { id: ref.id, label: ref.label };
}

export function toAuditScopeEntryResponse(record: AuditScopeEntryRecord): AuditScopeEntryResponse {
  return {
    id: record.id,
    targetType: record.targetType,
    target: toTargetRefResponse(record.target),
    linkedAt: record.linkedAt.toISOString(),
    linkedBy: { id: record.linkedBy.id, fullName: record.linkedBy.fullName },
  };
}
