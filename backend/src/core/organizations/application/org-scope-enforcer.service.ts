import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { OrgScopeDenialRecorderPort } from '../domain/ports/org-scope-denial-recorder.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { AuditEntityType } from '@prisma/client';

export interface OrgScopeAccessCheck {
  readonly scope: ScopeFilter;
  readonly actorUserId: string | undefined;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly organizationalUnitId: string | undefined;
}

export interface ExistingRecordScopeCheck {
  readonly scope: ScopeFilter;
  readonly actorUserId: string | undefined;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly entityLabel: string;
}

@Injectable()
export class OrgScopeEnforcerService {
  constructor(private readonly denialRecorder: OrgScopeDenialRecorderPort) {}

  async assertAccessible(check: OrgScopeAccessCheck): Promise<void> {
    if (this.isWithinScope(check.scope, check.organizationalUnitId)) {
      return;
    }

    await this.denyAccess(check, check.entityType);
  }

  async assertExistingRecordAccessible(
    check: ExistingRecordScopeCheck,
    resolveActualOrgUnit: () => Promise<string | undefined>,
  ): Promise<never> {
    const organizationalUnitId = await resolveActualOrgUnit();

    if (
      organizationalUnitId === undefined ||
      this.isWithinScope(check.scope, organizationalUnitId)
    ) {
      throw new NotFoundDomainError(check.entityLabel, check.entityId);
    }

    return this.denyAccess(
      {
        scope: check.scope,
        actorUserId: check.actorUserId,
        entityType: check.entityType,
        entityId: check.entityId,
        organizationalUnitId,
      },
      check.entityLabel,
    );
  }

  private isWithinScope(scope: ScopeFilter, organizationalUnitId: string | undefined): boolean {
    if (scope.kind === 'GLOBAL') {
      return true;
    }
    return organizationalUnitId !== undefined && scope.unitIds.has(organizationalUnitId);
  }

  private async denyAccess(check: OrgScopeAccessCheck, label: string): Promise<never> {
    await this.denialRecorder.recordDenied({
      actorUserId: check.actorUserId,
      entityType: check.entityType,
      entityId: check.entityId,
      organizationalUnitId: check.organizationalUnitId,
    });

    throw new NotFoundDomainError(label, check.entityId);
  }
}
