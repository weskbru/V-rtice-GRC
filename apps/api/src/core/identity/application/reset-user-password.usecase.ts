/**
 * T176 — `PUT /admin/users/{userId}/password` (`contracts/admin.openapi.yaml`,
 * FR-006, FR-017). Administrative reset: the new credential is flagged for
 * mandatory change on next sign-in and every session the user holds is
 * revoked (reason `PASSWORD_CHANGED`) in the same transaction. The
 * password value is never returned, logged or audited (FR-005, FR-035);
 * the reset action itself is audited (FR-032).
 */
import { Inject, Injectable } from '@nestjs/common';
import { AuditEntityType, AuditOutcome, SessionRevocationReason } from '@prisma/client';
import * as argon2 from 'argon2';

import {
  NotFoundDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { TransactionRunnerPort } from '../../../shared/persistence/transaction-runner.port';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { SessionService } from '../../sessions/application/session.service';
import {
  ARGON2_SETTINGS,
  PASSWORD_POLICY_SETTINGS,
  type Argon2Settings,
  type PasswordPolicySettings,
} from '../domain/identity-settings';
import { validatePassword } from '../domain/password-policy';
import { UserDirectoryPort } from '../domain/ports/user-directory.port';

const USER_ENTITY_LABEL = 'Usuário';

export interface ResetUserPasswordCommand {
  readonly actorUserId: string;
  readonly userId: string;
  readonly newPassword: string;
}

@Injectable()
export class ResetUserPasswordUseCase {
  constructor(
    private readonly userDirectory: UserDirectoryPort,
    private readonly sessionService: SessionService,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditRecorder,
    @Inject(ARGON2_SETTINGS) private readonly argon2Settings: Argon2Settings,
    @Inject(PASSWORD_POLICY_SETTINGS)
    private readonly passwordPolicySettings: PasswordPolicySettings,
  ) {}

  async execute(command: ResetUserPasswordCommand): Promise<void> {
    const actor = await this.userDirectory.findAdminRecordById(command.actorUserId);
    if (!actor) {
      throw new UnauthorizedDomainError();
    }

    const target = await this.userDirectory.findAdminRecordById(command.userId);
    if (!target) {
      throw new NotFoundDomainError(USER_ENTITY_LABEL, command.userId);
    }

    const violations = validatePassword(command.newPassword, this.passwordPolicySettings);
    if (violations.length > 0) {
      throw new ValidationDomainError(
        USER_MESSAGES.auth.passwordPolicyViolation,
        violations.map((violation) => ({ field: 'newPassword', message: violation.message })),
      );
    }

    const credential = await this.userDirectory.findLocalCredentialByUserId(command.userId);
    if (!credential) {
      // LOCAL is the only authentication method this release provisions
      // (data-model.md §1) — reachable only if a future federated identity
      // exists with no local credential at all.
      throw new ValidationDomainError(USER_MESSAGES.admin.localCredentialNotFound);
    }

    const passwordHash = await argon2.hash(command.newPassword, {
      type: argon2.argon2id,
      memoryCost: this.argon2Settings.memoryCost,
      timeCost: this.argon2Settings.timeCost,
      parallelism: this.argon2Settings.parallelism,
    });

    await this.transactionRunner.run(async () => {
      const passwordChangedAt = new Date();
      await this.userDirectory.updatePassword(credential.credentialId, {
        passwordHash,
        passwordChangedAt,
        mustChangePassword: true,
      });

      await this.auditRecorder.record({
        action: 'user.password_reset',
        entityType: AuditEntityType.LOCAL_CREDENTIAL,
        entityId: credential.credentialId,
        actorLabel: actor.fullName,
        newValues: { passwordChangedAt, mustChangePassword: true },
        organizationalUnitId: target.primaryOrgUnit?.id,
        outcome: AuditOutcome.SUCCESS,
      });

      // FR-017: every session for the user is revoked.
      await this.sessionService.revokeAllForUser(
        command.userId,
        SessionRevocationReason.PASSWORD_CHANGED,
        actor.fullName,
      );
    });
  }
}
