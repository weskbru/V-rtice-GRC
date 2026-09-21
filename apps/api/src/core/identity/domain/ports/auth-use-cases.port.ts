/**
 * The write-side authentication use cases (login, logout, own-password
 * change) as a single domain port, implemented by `AuthOrchestrator`
 * (`core/identity/infrastructure/auth-orchestrator.ts`).
 *
 * ## Why a port here at all, and why one class implements all three
 *
 * `AuthController` (`core/identity/presentation`) triggers writes that must
 * be atomic with an `AuditRecorder` call (ADR-005) — login (session
 * creation), logout (session revocation) and password change (credential
 * update + bulk session revocation). That atomicity requires
 * `PrismaService.runInTransaction(...)`, which only a `core-infrastructure`
 * (or `module-infrastructure`) element may call under the ADR-011 boundary
 * rules — `core-presentation` may not import `core-infrastructure` for any
 * capability, so `AuthController` cannot hold `PrismaService` even
 * indirectly through a same-capability infrastructure class. A domain port
 * is exactly how every other guard/service in this codebase already
 * reaches an infrastructure capability it cannot import directly
 * (`CurrentActorPort`, `PermissionDenialRecorderPort`, ...): the consumer
 * depends on the abstract class (`core-domain`, always importable), and
 * the concrete binding happens in `identity.module.ts`.
 *
 * One class implements all three because they share the same composed
 * dependencies (`PrismaService`, `AuditRecorder`, `LoginThrottleService`,
 * the `AuthenticationProvider`s, `IdentityResolverService`, `SessionService`,
 * `UserDirectoryPort`) — splitting into three single-method infrastructure
 * classes would triplicate that wiring for no isolation benefit (nothing
 * ever substitutes one operation's implementation independently of the
 * others).
 */
import type { UserProfile } from './user-directory.port';
import type { ScopeFilter } from '../../../../shared/persistence/scope-filter';
import type { AuthenticationMethod, UserStatus } from '@prisma/client';

export interface LoginCommand {
  readonly email: string;
  readonly password: string;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
}

export interface SessionSummary {
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastActivityAt: Date;
  readonly authenticationMethod: AuthenticationMethod;
  readonly ipAddress: string | undefined;
  readonly userAgent: string | undefined;
}

export interface LoginOutcome {
  readonly rawToken: string;
  readonly session: SessionSummary;
  readonly profile: UserProfile;
  readonly permissions: readonly string[];
  readonly scope: ScopeFilter;
  readonly mustChangePassword: boolean;
}

export interface LogoutCommand {
  readonly sessionId: string;
  readonly actorLabel: string;
}

export interface ChangeOwnPasswordCommand {
  readonly userId: string;
  readonly actorLabel: string;
  readonly currentPassword: string;
  readonly newPassword: string;
}

export interface DeactivateUserCommand {
  readonly userId: string;
  readonly actorLabel: string;
}

export abstract class AuthUseCasesPort {
  /** Throws `RateLimitedDomainError` (429) if throttled, `UnauthorizedDomainError`
   * (401, generic — FR-007) for any other failure (unknown account, wrong
   * password, inactive account — all indistinguishable to the caller). */
  abstract login(command: LoginCommand): Promise<LoginOutcome>;

  abstract logout(command: LogoutCommand): Promise<void>;

  /** Throws `UnauthorizedDomainError` if the current password is wrong (or
   * no local credential exists), `ValidationDomainError` (422) if the new
   * password fails policy. On success, every session for the user is
   * revoked (FR-017), including the one making this request. */
  abstract changeOwnPassword(command: ChangeOwnPasswordCommand): Promise<void>;

  /** FR-011/FR-017: sets the user `INACTIVE` and revokes every one of their
   * sessions, atomically and audited. Not yet exposed over HTTP in this
   * release (user administration is a later phase) — exercised directly by
   * `test/integration/user-deactivation-auth.spec.ts` against this port,
   * which is how a future admin-facing endpoint will call it too. */
  abstract deactivateUser(command: DeactivateUserCommand): Promise<void>;
}

export type { UserStatus };
