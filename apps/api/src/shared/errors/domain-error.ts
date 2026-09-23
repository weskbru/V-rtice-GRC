import { USER_MESSAGES } from '../messages/user-messages';

export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'OPTIMISTIC_LOCK'
  | 'VALIDATION'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'PASSWORD_CHANGE_REQUIRED';

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  protected constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundDomainError extends DomainError {
  readonly code = 'NOT_FOUND' as const;

  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
  ) {
    super(`${entityType} ${entityId} não foi encontrado(a).`);
  }
}

export class ConflictDomainError extends DomainError {
  readonly code = 'CONFLICT' as const;

  constructor(message: string) {
    super(message);
  }
}

export class OptimisticLockDomainError extends ConflictDomainError {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
    public readonly currentStatus?: string,
  ) {
    super(
      `${entityType} ${entityId} foi modificado(a) simultaneamente ` +
        `(versão esperada ${String(expectedVersion)}, encontrada ${String(actualVersion)}).`,
    );
  }
}

export interface ValidationFieldError {
  readonly field: string;
  readonly message: string;
}

export class ValidationDomainError extends DomainError {
  readonly code = 'VALIDATION' as const;

  constructor(
    message: string,
    public readonly errors: readonly ValidationFieldError[] = [],
  ) {
    super(message);
  }
}

export class ForbiddenDomainError extends DomainError {
  readonly code = 'FORBIDDEN' as const;

  constructor(message: string = USER_MESSAGES.auth.forbidden) {
    super(message);
  }
}

export class UnauthorizedDomainError extends DomainError {
  readonly code = 'UNAUTHORIZED' as const;

  constructor(message: string = USER_MESSAGES.auth.authenticationRequired) {
    super(message);
  }
}

export class PasswordChangeRequiredDomainError extends DomainError {
  readonly code = 'PASSWORD_CHANGE_REQUIRED' as const;

  constructor(message: string = USER_MESSAGES.auth.passwordChangeRequired) {
    super(message);
  }
}

export class RateLimitedDomainError extends DomainError {
  readonly code = 'RATE_LIMITED' as const;

  constructor(
    message: string = USER_MESSAGES.auth.tooManyAttempts,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
