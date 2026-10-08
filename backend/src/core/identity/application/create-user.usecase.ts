import { Inject, Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome } from '@prisma/client';
import * as argon2 from 'argon2';

import {
  ConflictDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { RoleAdminService } from '../../authorization/application/role-admin.service';
import { ScopeGrantService } from '../../organizations/application/scope-grant.service';
import {
  ARGON2_SETTINGS,
  PASSWORD_POLICY_SETTINGS,
  type Argon2Settings,
  type PasswordPolicySettings,
} from '../domain/identity-settings';
import { validatePassword } from '../domain/password-policy';
import { UserDirectoryPort, type AdminUserRecord } from '../domain/ports/user-directory.port';

export interface CreateUserScopeGrantCommand {
  readonly scopeType: 'GLOBAL' | 'UNIT';
  readonly orgUnitId?: string | undefined;
}

export interface CreateUserCommand {
  readonly actorUserId: string;
  readonly email: string;
  readonly fullName: string;
  readonly jobTitle: string | undefined;
  readonly primaryOrgUnitId: string | undefined;
  readonly initialPassword: string;
  readonly roleIds: readonly string[] | undefined;
  readonly scopeGrants: readonly CreateUserScopeGrantCommand[] | undefined;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userDirectory: UserDirectoryPort,
    private readonly roleAdmin: RoleAdminService,
    private readonly scopeGrants: ScopeGrantService,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditRecorder,
    @Inject(ARGON2_SETTINGS) private readonly argon2Settings: Argon2Settings,
    @Inject(PASSWORD_POLICY_SETTINGS)
    private readonly passwordPolicySettings: PasswordPolicySettings,
  ) {}

  async execute(command: CreateUserCommand): Promise<AdminUserRecord> {
    const actor = await this.userDirectory.findAdminRecordById(command.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const violations = validatePassword(command.initialPassword, this.passwordPolicySettings);
    if (violations.length > 0) {
      throw new ValidationDomainError(
        USER_MESSAGES.auth.passwordPolicyViolation,
        violations.map((violation) => ({ field: 'initialPassword', message: violation.message })),
      );
    }

    const existingByEmail = await this.userDirectory.findByEmail(command.email);
    if (existingByEmail) {
      throw new ConflictDomainError(USER_MESSAGES.admin.emailAlreadyInUse);
    }

    if (command.primaryOrgUnitId) {
      const orgUnit = await this.userDirectory.findOrgUnitForValidation(command.primaryOrgUnitId);
      if (!orgUnit?.isActive) {
        throw new ValidationDomainError(USER_MESSAGES.admin.parentOrgUnitNotFound);
      }
    }

    const passwordHash = await argon2.hash(command.initialPassword, {
      type: argon2.argon2id,
      memoryCost: this.argon2Settings.memoryCost,
      timeCost: this.argon2Settings.timeCost,
      parallelism: this.argon2Settings.parallelism,
    });

    return this.transactionRunner.run(async () => {
      const created = await this.userDirectory.createUserWithCredential({
        email: command.email,
        fullName: command.fullName,
        jobTitle: command.jobTitle,
        primaryOrgUnitId: command.primaryOrgUnitId,
        passwordHash,
        mustChangePassword: true,
      });

      await this.auditRecorder.record({
        action: 'user.created',
        entityType: AuditEntityType.USER,
        entityId: created.id,
        actorLabel: actor.fullName,
        newValues: {
          email: created.email,
          fullName: created.fullName,
          jobTitle: created.jobTitle ?? null,
          status: created.status,
          primaryOrgUnitId: command.primaryOrgUnitId ?? null,
        },
        organizationalUnitId: command.primaryOrgUnitId,
        outcome: AuditOutcome.SUCCESS,
      });

      if (command.roleIds && command.roleIds.length > 0) {
        await this.roleAdmin.replaceUserRoles({
          actorUserId: command.actorUserId,
          userId: created.id,
          roleIds: command.roleIds,
        });
      }

      if (command.scopeGrants) {
        for (const grant of command.scopeGrants) {
          await this.scopeGrants.grant({
            actorUserId: command.actorUserId,
            userId: created.id,
            scopeType: grant.scopeType,
            orgUnitId: grant.orgUnitId,
          });
        }
      }

      const finalRecord = await this.userDirectory.findAdminRecordById(created.id);
      return finalRecord!;
    });
  }
}
