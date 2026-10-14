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
  abstract login(command: LoginCommand): Promise<LoginOutcome>;

  abstract logout(command: LogoutCommand): Promise<void>;

  abstract changeOwnPassword(command: ChangeOwnPasswordCommand): Promise<void>;

  abstract deactivateUser(command: DeactivateUserCommand): Promise<void>;
}

export type { UserStatus };
