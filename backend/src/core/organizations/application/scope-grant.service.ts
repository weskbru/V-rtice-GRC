import { Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome, type OrgScopeType } from '@prisma/client';

import {
  ConflictDomainError,
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { ActorDirectoryPort } from '../domain/ports/actor-directory.port';
import {
  OrgScopeRepositoryPort,
  type DetailedOrgScopeGrantRecord,
} from '../domain/ports/org-scope-repository.port';
import { OrgUnitAdminRepositoryPort } from '../domain/ports/org-unit-admin-repository.port';

const USER_ENTITY_LABEL = 'Usuário';
const GRANT_ENTITY_LABEL = 'Concessão de escopo';

export interface GrantOrgScopeCommand {
  readonly actorUserId: string;
  readonly userId: string;
  readonly scopeType: OrgScopeType;
  readonly orgUnitId: string | undefined;
}

@Injectable()
export class ScopeGrantService {
  constructor(
    private readonly repository: OrgScopeRepositoryPort,
    private readonly orgUnitAdminRepository: OrgUnitAdminRepositoryPort,
    private readonly actorDirectory: ActorDirectoryPort,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditRecorder,
  ) {}

  async list(userId: string): Promise<readonly DetailedOrgScopeGrantRecord[]> {
    await this.requireUserExists(userId);
    return this.repository.listDetailedGrants(userId);
  }

  async grant(command: GrantOrgScopeCommand): Promise<DetailedOrgScopeGrantRecord> {
    const actorLabel = await this.resolveActorLabel(command.actorUserId);
    await this.requireUserExists(command.userId);
    this.assertConsistentScope(command.scopeType, command.orgUnitId);

    if (command.scopeType === 'UNIT') {
      const unit = await this.orgUnitAdminRepository.findById(command.orgUnitId!);
      if (!unit) {
        throw new ValidationDomainError(USER_MESSAGES.admin.scopeGrantOrgUnitNotFound);
      }
    }

    const duplicate = await this.repository.findDuplicateGrant({
      userId: command.userId,
      scopeType: command.scopeType,
      orgUnitId: command.orgUnitId,
    });
    if (duplicate) {
      throw new ConflictDomainError(USER_MESSAGES.admin.scopeGrantDuplicate);
    }

    return this.transactionRunner.run(async () => {
      const grant = await this.repository.createGrant({
        userId: command.userId,
        scopeType: command.scopeType,
        orgUnitId: command.orgUnitId,
        grantedByUserId: command.actorUserId,
      });

      await this.repository.bumpGrantsVersion();

      await this.auditRecorder.record({
        action: 'org_scope_grant.granted',
        entityType: AuditEntityType.ORG_SCOPE_GRANT,
        entityId: grant.id,
        actorLabel,
        newValues: {
          scopeType: grant.scopeType,
          orgUnitId: grant.orgUnit?.id ?? null,
          grantedByUserId: command.actorUserId,
          grantedAt: grant.grantedAt,
        },
        organizationalUnitId: grant.orgUnit?.id,
        outcome: AuditOutcome.SUCCESS,
      });

      return grant;
    });
  }

  async revoke(userId: string, grantId: string, actorUserId: string): Promise<void> {
    const actorLabel = await this.resolveActorLabel(actorUserId);
    await this.requireUserExists(userId);

    const grant = await this.repository.findGrantById(userId, grantId);
    if (!grant) {
      throw new NotFoundDomainError(GRANT_ENTITY_LABEL, grantId);
    }

    await this.transactionRunner.run(async () => {
      await this.auditRecorder.record({
        action: 'org_scope_grant.revoked',
        entityType: AuditEntityType.ORG_SCOPE_GRANT,
        entityId: grantId,
        actorLabel,
        previousValues: { scopeType: grant.scopeType, orgUnitId: grant.orgUnitId ?? null },
        organizationalUnitId: grant.orgUnitId,
        outcome: AuditOutcome.SUCCESS,
      });

      await this.repository.deleteGrant(grantId);
      await this.repository.bumpGrantsVersion();
    });
  }

  private assertConsistentScope(scopeType: OrgScopeType, orgUnitId: string | undefined): void {
    if (scopeType === 'UNIT' && !orgUnitId) {
      throw new ValidationDomainError(USER_MESSAGES.admin.scopeGrantInconsistent);
    }
    if (scopeType === 'GLOBAL' && orgUnitId) {
      throw new ValidationDomainError(USER_MESSAGES.admin.scopeGrantInconsistent);
    }
  }

  private async requireUserExists(userId: string): Promise<void> {
    if (!(await this.repository.userExists(userId))) {
      throw new NotFoundDomainError(USER_ENTITY_LABEL, userId);
    }
  }

  private async resolveActorLabel(actorUserId: string): Promise<string> {
    const label = await this.actorDirectory.findActorLabel(actorUserId);
    if (!label) {
      throw new UnauthorizedDomainError();
    }
    return label;
  }
}
