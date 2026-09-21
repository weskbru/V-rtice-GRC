/**
 * `AuthUseCasesPort` implementation (T058-T068). See that port's header for
 * why this composition lives here (`core-infrastructure`) rather than in
 * `core/identity/application`: it needs `PrismaService.runInTransaction`
 * (top-level `infrastructure`) to make each write atomic with its
 * `AuditRecorder` call, exactly like `AuditPermissionDenialRecorder`/
 * `AuditOrgScopeDenialRecorder`/`AuditSessionExpiryRecorder` before it.
 *
 * Every dependency below is legal from `core-infrastructure` under the
 * ADR-011 boundary policies: `PrismaService` (top-level `infrastructure`),
 * `AuditRecorder` (a different capability's `core-application`),
 * `SessionService`/`PermissionResolverService`/`ScopeResolverService`
 * (other capabilities' `core-application`), and everything else from this
 * same capability's `domain`/`application`.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  AuditEntityType,
  AuditOutcome,
  AuthenticationMethod,
  SessionRevocationReason,
  UserStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

import { AppLogger } from '../../../infrastructure/logging/app-logger.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  RateLimitedDomainError,
  UnauthorizedDomainError,
  ValidationDomainError,
} from '../../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../../shared/messages/user-messages';
import { AuditRecorder } from '../../audit/application/audit-recorder.service';
import { PermissionResolverService } from '../../authorization/application/permission-resolver.service';
import { ScopeResolverService } from '../../organizations/application/scope-resolver.service';
import { SessionService } from '../../sessions/application/session.service';
import { IdentityResolverService } from '../application/identity-resolver.service';
import { LoginThrottleService } from '../application/login-throttle.service';
import {
  AUTHENTICATION_PROVIDERS,
  type AuthenticationProvider,
} from '../domain/authentication-provider';
import {
  ARGON2_SETTINGS,
  PASSWORD_POLICY_SETTINGS,
  type Argon2Settings,
  type PasswordPolicySettings,
} from '../domain/identity-settings';
import { validatePassword } from '../domain/password-policy';
import {
  AuthUseCasesPort,
  type ChangeOwnPasswordCommand,
  type DeactivateUserCommand,
  type LoginCommand,
  type LoginOutcome,
  type LogoutCommand,
} from '../domain/ports/auth-use-cases.port';
import { UserDirectoryPort } from '../domain/ports/user-directory.port';

const GENERIC_INVALID_CREDENTIALS_MESSAGE = USER_MESSAGES.auth.invalidCredentials;
const GENERIC_CURRENT_PASSWORD_MESSAGE = USER_MESSAGES.auth.currentPasswordIncorrect;

@Injectable()
export class AuthOrchestrator extends AuthUseCasesPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditRecorder: AuditRecorder,
    private readonly loginThrottle: LoginThrottleService,
    @Inject(AUTHENTICATION_PROVIDERS) private readonly providers: readonly AuthenticationProvider[],
    private readonly identityResolver: IdentityResolverService,
    private readonly sessionService: SessionService,
    private readonly userDirectory: UserDirectoryPort,
    private readonly permissionResolver: PermissionResolverService,
    private readonly scopeResolver: ScopeResolverService,
    @Inject(ARGON2_SETTINGS) private readonly argon2Settings: Argon2Settings,
    @Inject(PASSWORD_POLICY_SETTINGS)
    private readonly passwordPolicySettings: PasswordPolicySettings,
    private readonly logger: AppLogger,
  ) {
    super();
  }

  async login(command: LoginCommand): Promise<LoginOutcome> {
    try {
      await this.loginThrottle.assertNotThrottled({
        email: command.email,
        ipAddress: command.ipAddress,
      });
    } catch (error) {
      if (error instanceof RateLimitedDomainError) {
        // Assurance fix — a request refused because THIS account is
        // already locked is its own semantic fact, distinct from the
        // shared per-origin ceiling (D-6, not account-specific). Best
        // effort: the refusal itself (already thrown/rethrown below) never
        // depends on whether this succeeds.
        await this.recordAccountLockInForceIfApplicable(command.email);
      }
      throw error;
    }

    const provider = this.providers.find((candidate) =>
      candidate.supports(AuthenticationMethod.LOCAL),
    );
    if (!provider) {
      throw new UnauthorizedDomainError(GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    const result = await provider.authenticate({
      method: 'LOCAL',
      email: command.email,
      password: command.password,
    });

    if (result.outcome !== 'AUTHENTICATED') {
      await this.prisma.runInTransaction(async () => {
        const throttleResult = await this.loginThrottle.recordFailedAttempt({
          email: command.email,
          ipAddress: command.ipAddress,
        });
        await this.auditRecorder.record({
          action:
            result.outcome === 'ACCOUNT_INACTIVE'
              ? 'auth.login_failed_inactive'
              : 'auth.login_failed',
          entityType: AuditEntityType.USER,
          entityId: throttleResult.userId,
          actorLabel: command.email,
          newValues: { email: command.email },
          outcome: AuditOutcome.FAILURE,
        });
      });
      throw new UnauthorizedDomainError(GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    const identity = await this.identityResolver.resolve(result.subject);

    const created = await this.prisma.runInTransaction(async () => {
      await this.loginThrottle.recordSuccessfulAttempt(command.email);
      const session = await this.sessionService.createSession({
        userId: identity.id,
        authenticationMethod: AuthenticationMethod.LOCAL,
        ipAddress: command.ipAddress,
        userAgent: command.userAgent,
        actorLabel: identity.fullName,
      });
      await this.userDirectory.touchLastLoginAt(identity.id, new Date());
      return session;
    });

    // S-01: `warmCache` needs `mustChangePassword` to seed the validation
    // cache correctly (`ValidatedSession.mustChangePassword`); it is
    // already resolved below for the login response, so it is passed here
    // too rather than re-derived a second time.
    await this.sessionService.warmCache(
      created.session,
      result.subject.profile.mustChangePassword ?? false,
    );

    const [profile, permissions, scope] = await Promise.all([
      this.userDirectory.findProfileById(identity.id),
      this.permissionResolver.getEffectivePermissions(identity.id),
      this.scopeResolver.resolveScope(identity.id),
    ]);

    if (!profile) {
      throw new UnauthorizedDomainError(GENERIC_INVALID_CREDENTIALS_MESSAGE);
    }

    return {
      rawToken: created.rawToken,
      session: {
        createdAt: created.session.createdAt,
        expiresAt: created.session.expiresAt,
        lastActivityAt: created.session.lastActivityAt,
        authenticationMethod: created.session.authenticationMethod,
        ipAddress: created.session.ipAddress,
        userAgent: created.session.userAgent,
      },
      profile,
      permissions: Array.from(permissions),
      scope,
      mustChangePassword: result.subject.profile.mustChangePassword ?? false,
    };
  }

  /**
   * Assurance fix — records `auth.login_refused_locked` (`LOCAL_CREDENTIAL`,
   * `DENIED`) when `assertNotThrottled` refused this attempt because the
   * ACCOUNT itself is already locked (as opposed to the shared per-origin
   * ceiling, which is not account-specific and gets no such event, D-6).
   * Lives here rather than inside `LoginThrottleService.assertNotThrottled`
   * because that pre-check runs BEFORE any transaction is open, and
   * `AuditRecorder` requires one (ADR-005) — `AuthOrchestrator`
   * (`core-infrastructure`) is the layer that legitimately holds
   * `PrismaService` to open one; `LoginThrottleService`
   * (`core-application`) cannot. A re-read of the lock state here (rather
   * than threading a discriminant through `RateLimitedDomainError`) keeps
   * that error's shape — and FR-007's identical-429-for-both-reasons
   * guarantee — completely untouched.
   *
   * Best-effort deliberately: `login`'s caller always sees the original
   * `RateLimitedDomainError` regardless of whether this succeeds — an
   * audit-subsystem hiccup must never turn into an extra client-visible
   * failure on top of an already-correct refusal (same discipline
   * `AuditOrgScopeDenialRecorder` documents for its own DENIED writes).
   */
  private async recordAccountLockInForceIfApplicable(email: string): Promise<void> {
    const lock = await this.loginThrottle.findActiveAccountLock(email);
    if (!lock) {
      return;
    }

    try {
      await this.prisma.runInTransaction(async () => {
        await this.auditRecorder.record({
          action: 'auth.login_refused_locked',
          entityType: AuditEntityType.LOCAL_CREDENTIAL,
          entityId: lock.credentialId,
          actorLabel: email,
          newValues: { failedAttempts: lock.failedAttempts, lockedUntil: lock.lockedUntil },
          outcome: AuditOutcome.DENIED,
        });
      });
    } catch (error) {
      // Best-effort — see this method's own doc comment. Mirrors
      // `AuditOrgScopeDenialRecorder`'s own failure handling: logged via
      // `auditOps` (audit-plumbing failure, not the security fact itself),
      // never rethrown.
      this.logger.auditOps('Failed to record a DENIED audit event for a login refused as locked.', {
        credentialId: lock.credentialId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async logout(command: LogoutCommand): Promise<void> {
    await this.prisma.runInTransaction(async () => {
      await this.sessionService.revokeSession(
        command.sessionId,
        SessionRevocationReason.LOGOUT,
        command.actorLabel,
      );
    });
  }

  async changeOwnPassword(command: ChangeOwnPasswordCommand): Promise<void> {
    const credential = await this.userDirectory.findLocalCredentialByUserId(command.userId);
    if (!credential) {
      throw new UnauthorizedDomainError(GENERIC_CURRENT_PASSWORD_MESSAGE);
    }

    const currentPasswordMatches = await argon2
      .verify(credential.passwordHash, command.currentPassword)
      .catch(() => false);
    if (!currentPasswordMatches) {
      throw new UnauthorizedDomainError(GENERIC_CURRENT_PASSWORD_MESSAGE);
    }

    const violations = validatePassword(command.newPassword, this.passwordPolicySettings);
    if (violations.length > 0) {
      throw new ValidationDomainError(
        USER_MESSAGES.auth.passwordPolicyViolation,
        violations.map((violation) => ({ field: 'newPassword', message: violation.message })),
      );
    }

    const newPasswordHash = await argon2.hash(command.newPassword, {
      type: argon2.argon2id,
      memoryCost: this.argon2Settings.memoryCost,
      timeCost: this.argon2Settings.timeCost,
      parallelism: this.argon2Settings.parallelism,
    });

    await this.prisma.runInTransaction(async () => {
      const passwordChangedAt = new Date();
      await this.userDirectory.updatePassword(credential.credentialId, {
        passwordHash: newPasswordHash,
        passwordChangedAt,
        mustChangePassword: false,
      });
      await this.auditRecorder.record({
        action: 'auth.password_changed',
        entityType: AuditEntityType.LOCAL_CREDENTIAL,
        entityId: credential.credentialId,
        actorLabel: command.actorLabel,
        newValues: { passwordChangedAt, mustChangePassword: false },
        outcome: AuditOutcome.SUCCESS,
      });
      // FR-017: every session for the user, including the one making this
      // request — the caller must authenticate again (auth.openapi.yaml).
      await this.sessionService.revokeAllForUser(
        command.userId,
        SessionRevocationReason.PASSWORD_CHANGED,
        command.actorLabel,
      );
    });
  }

  async deactivateUser(command: DeactivateUserCommand): Promise<void> {
    await this.prisma.runInTransaction(async () => {
      const previousStatus = await this.userDirectory.setStatus(
        command.userId,
        UserStatus.INACTIVE,
      );
      if (previousStatus === undefined) {
        return;
      }
      await this.auditRecorder.record({
        action: 'user.deactivated',
        entityType: AuditEntityType.USER,
        entityId: command.userId,
        actorLabel: command.actorLabel,
        previousValues: { status: previousStatus },
        newValues: { status: UserStatus.INACTIVE },
        outcome: AuditOutcome.SUCCESS,
      });
      // FR-017: deactivation revokes every session immediately.
      await this.sessionService.revokeAllForUser(
        command.userId,
        SessionRevocationReason.USER_DEACTIVATED,
        command.actorLabel,
      );
    });
  }
}
