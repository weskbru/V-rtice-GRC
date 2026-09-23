import type { AuditEntityType } from '@prisma/client';

export interface OrgScopeDenialContext {
  readonly actorUserId: string | undefined;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly organizationalUnitId: string | undefined;
}

export abstract class OrgScopeDenialRecorderPort {
  abstract recordDenied(context: OrgScopeDenialContext): Promise<void>;
}
