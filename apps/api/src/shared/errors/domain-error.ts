/**
 * Shared kernel — domain error types (T020).
 *
 * `shared/**` is the innermost layer of the architecture (ADR-011): it must
 * never import from `core`, `modules` or `infrastructure` (enforced by
 * `apps/api/eslint.config.mjs`'s boundary rules), so these types carry no
 * framework dependency — no NestJS `HttpException`, no Prisma error type.
 *
 * `infrastructure/http/problem-details.filter.ts` (T021) is the ONLY place
 * that maps a `DomainError` to an HTTP status code and an
 * `application/problem+json` body — domain and application code throws
 * these, and never constructs an HTTP response directly.
 *
 * Every kind carries a stable `code`, machine-readable and safe to log or
 * (for the generic ones) return to a client, and a human-readable `message`
 * that must never itself embed a secret, a stack trace or a raw database
 * error (FR-107/FR-108 — the filter also guards this, but the error should
 * not carry that content in the first place).
 *
 * Default/generic `message`s below are pt-BR (localization cleanup — the
 * product is pt-BR only, no runtime locale negotiation) and are drawn from
 * `shared/messages/user-messages.ts`, the centralized catalog every
 * client-visible string in this API is meant to come from.
 */
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

/**
 * The requested entity does not exist, OR it exists but the caller's
 * organizational scope must not be able to distinguish "does not exist"
 * from "exists but you may not see it" (ADR-009/FR-030) — callers making
 * that scope decision throw this rather than `ForbiddenDomainError` when
 * existence itself is sensitive.
 */
export class NotFoundDomainError extends DomainError {
  readonly code = 'NOT_FOUND' as const;

  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
  ) {
    super(`${entityType} ${entityId} não foi encontrado(a).`);
  }
}

/**
 * A write conflicts with the entity's current state for a reason other than
 * concurrent modification (e.g. a uniqueness rule, an invalid state
 * transition target already occupied). `OptimisticLockDomainError` is the
 * specific, more common case below.
 */
export class ConflictDomainError extends DomainError {
  readonly code = 'CONFLICT' as const;

  constructor(message: string) {
    super(message);
  }
}

/**
 * Optimistic-locking conflict (ADR-013): the caller's `If-Match`/expected
 * `version` no longer matches the entity's current version because another
 * write committed first. Always maps to `409`, never to a silent
 * last-write-wins.
 */
export class OptimisticLockDomainError extends ConflictDomainError {
  constructor(
    public readonly entityType: string,
    public readonly entityId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
    /** Optional: the entity's current lifecycle status at the moment of
     * conflict, when the caller has it available (e.g.
     * `UpdateRiskUseCase`). Populates `VersionConflictProblem.currentStatus`
     * (`contracts/risks.openapi.yaml`, ADR-013) via
     * `ProblemDetailsFilter` — `undefined` for any future caller that has
     * no notion of "status" for the entity in conflict. */
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

/**
 * A business-rule validation failure distinct from request-shape validation
 * (which the `ValidationPipe`, T022, already rejects at the HTTP boundary).
 * Carries one or more field-level errors so the client can attribute the
 * failure, matching the `errors[]` array in the problem+json shape
 * (ADR-009).
 */
export class ValidationDomainError extends DomainError {
  readonly code = 'VALIDATION' as const;

  constructor(
    message: string,
    public readonly errors: readonly ValidationFieldError[] = [],
  ) {
    super(message);
  }
}

/**
 * The caller is authenticated and the entity's existence is not itself
 * sensitive, but the caller lacks the permission or scope to perform the
 * operation. Use `NotFoundDomainError` instead whenever existence
 * disclosure is a concern (FR-030).
 */
export class ForbiddenDomainError extends DomainError {
  readonly code = 'FORBIDDEN' as const;

  constructor(message: string = USER_MESSAGES.auth.forbidden) {
    super(message);
  }
}

/** No authenticated session, or the session is no longer valid. */
export class UnauthorizedDomainError extends DomainError {
  readonly code = 'UNAUTHORIZED' as const;

  constructor(message: string = USER_MESSAGES.auth.authenticationRequired) {
    super(message);
  }
}

/**
 * S-01 (audit A6-F01): the caller has a valid, authenticated session, but
 * `LocalCredential.mustChangePassword` is `true` for this user and the
 * requested route is not one of the few exempted while that is pending
 * (`@AllowedDuringMandatoryPasswordChange()` — own session/profile, change
 * password, logout; see `MandatoryPasswordChangeGuard`,
 * `core/sessions/presentation`). Deliberately distinct from
 * `ForbiddenDomainError` — same `403` status, but its own problem `type` —
 * so a client can react specifically (redirect to the password-change
 * screen) instead of rendering a generic "access denied" message.
 */
export class PasswordChangeRequiredDomainError extends DomainError {
  readonly code = 'PASSWORD_CHANGE_REQUIRED' as const;

  constructor(message: string = USER_MESSAGES.auth.passwordChangeRequired) {
    super(message);
  }
}

/**
 * Added for T066 (FR-008): a caller has exceeded the per-account or
 * per-origin authentication attempt budget. Maps to `429` (never `401`),
 * with an optional `Retry-After` value the filter forwards as a response
 * header — never a body detail more specific than the generic message,
 * matching auth.openapi.yaml's "the body never discloses whether an account
 * exists" requirement for `TooManyRequests`.
 */
export class RateLimitedDomainError extends DomainError {
  readonly code = 'RATE_LIMITED' as const;

  constructor(
    message: string = USER_MESSAGES.auth.tooManyAttempts,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
