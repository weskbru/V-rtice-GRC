/**
 * T176 — `POST /admin/users` (`contracts/admin.openapi.yaml`, FR-001,
 * US8 AS1). Provisions an internal platform identity with a local
 * credential flagged for mandatory change on first sign-in, optionally
 * assigning roles and organizational scope grants atomically with the
 * user (contract: "applied atomically with the user").
 *
 * Reuses `RoleAdminService.replaceUserRoles` (`core/authorization`) and
 * `ScopeGrantService.grant` (`core/organizations`) for the optional
 * `roleIds`/`scopeGrants` rather than duplicating their validation/audit
 * logic — both are called from inside this use case's own
 * `TransactionRunnerPort.run(...)` scope, so their own (redundant but
 * harmless) `runInTransaction` calls simply join the already-open
 * transaction (`PrismaService.runInTransaction`'s documented behavior).
 *
 * The initial password is validated against the same
 * `PASSWORD_POLICY_SETTINGS`/hashed with the same `ARGON2_SETTINGS` as
 * `AuthOrchestrator.changeOwnPassword` — never stored in reversible form,
 * never logged or audited (FR-005, FR-035).
 */
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
      // Defensive only: `SessionGuard` already proved this actor has a
      // live session (see `create-risk.usecase.ts`'s identical reasoning).
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
      // Cannot be `undefined`: the user row was just created inside this
      // same transaction.
      return finalRecord!;
    });
  }
}
