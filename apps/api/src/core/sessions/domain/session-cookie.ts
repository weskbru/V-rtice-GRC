/**
 * T063 — opaque session token generation/hashing and cookie attribute
 * shape (ADR-002, FR-019).
 *
 * ## Placement: `domain/`, not `infrastructure/` as the task sheet names it
 *
 * The task text places this file at `core/sessions/infrastructure/`. It is
 * placed here instead, deliberately, because of who must call it:
 * `SessionGuard` (`core/sessions/presentation`) reads the cookie off every
 * request, and `AuthController` (`core/identity/presentation`) sets/clears
 * it on login/logout/password-change. Under the ADR-011 boundary rules,
 * `core-presentation` may import `core-domain`/`core-application`/
 * `core-presentation` — NEVER `core-infrastructure`, for any capability,
 * including its own. Had this file stayed under `infrastructure/`, neither
 * presentation-layer consumer could legally import it, and per this task's
 * working rule ("report a conflict rather than weakening a rule") the fix
 * is to relocate the file, not to add a new boundary-lint exception.
 *
 * This placement is legitimate, not a workaround: everything below is pure
 * (`node:crypto` + arithmetic, no NestJS, no Express runtime dependency —
 * only a structural, type-only shape for the cookie attributes a caller
 * applies via whatever HTTP framework it holds), matching what `domain/`
 * already requires elsewhere in this codebase (e.g. `org-unit-path.ts`).
 * Generating a 256-bit opaque token and hashing it with SHA-256 before
 * storage is exactly the kind of business rule (ADR-002) `domain/` exists
 * to express independently of infrastructure.
 *
 * ## Why SHA-256, and why only the hash is ever persisted
 *
 * The raw token is the bearer credential (whoever holds it, until
 * expiry/revocation, IS the session). Storing only `sha256(token)` means a
 * database disclosure yields no usable session — matching
 * `Session.tokenHash` in data-model.md §2. The raw value is returned to the
 * caller exactly once (at creation) and is never logged, never re-derivable
 * from the hash, and never part of any `AuditRecorder` payload (FR-107,
 * FR-108) — grep-proof by construction: no variable holding it is ever
 * passed to a logger or to `AuditRecorder.record`.
 */
import { createHash, randomBytes } from 'node:crypto';

import type { SessionSettings } from './session-settings';

const TOKEN_BYTES = 32; // 256 bits (ADR-002).

/** A fresh, cryptographically random, URL-safe opaque session token. */
export function generateOpaqueSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** SHA-256 of the raw token, hex-encoded — the only form ever persisted. */
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/** Generic cookie-attribute shape any HTTP framework's response object can
 * be asked to apply (`res.cookie(name, value, options)` /
 * `res.clearCookie(name, options)` in Express both accept exactly this
 * option shape) — kept structural rather than importing `express` types at
 * runtime, though a type-only `express` import would also be acceptable
 * here (an external npm package, not a `src/**` path, so unaffected by the
 * boundary lint either way). */
export interface SessionCookieOptions {
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: 'lax' | 'strict' | 'none';
  readonly path: '/';
  readonly maxAge?: number;
}

export interface SessionCookieDescriptor {
  readonly name: string;
  readonly options: SessionCookieOptions;
}

/** Attributes for setting the cookie at login: `maxAge` mirrors the
 * session's absolute lifetime (ADR-002 sets `Path=/` unconditionally). */
export function buildSessionCookieDescriptor(settings: SessionSettings): SessionCookieDescriptor {
  return {
    name: settings.cookieName,
    options: {
      httpOnly: true,
      secure: settings.cookieSecure,
      sameSite: settings.cookieSameSite,
      path: '/',
      maxAge: settings.absoluteLifetimeHours * 60 * 60 * 1000,
    },
  };
}

/** Attributes for clearing the cookie at logout/password-change — the
 * `httpOnly`/`secure`/`sameSite`/`path` values must match the ones used to
 * set it, or some browsers will not clear it. */
export function buildSessionCookieClearDescriptor(
  settings: SessionSettings,
): SessionCookieDescriptor {
  return {
    name: settings.cookieName,
    options: {
      httpOnly: true,
      secure: settings.cookieSecure,
      sameSite: settings.cookieSameSite,
      path: '/',
    },
  };
}
