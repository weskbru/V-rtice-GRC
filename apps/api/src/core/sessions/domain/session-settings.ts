/**
 * T062/T063 — session configuration shape + DI token.
 *
 * `core-application`/`core-presentation` may not import `AppConfigService`
 * directly (top-level `infrastructure`, ADR-011). This interface duplicates
 * the shape of `AppConfigService.session` on purpose (rather than importing
 * its type) so `SessionService`/`SessionGuard`/`AuthController` depend only
 * on `core-domain`; `sessions.module.ts` (the composition root, unclassified
 * by the boundary rules) is the only place that reads the real
 * `AppConfigService` and provides this token.
 */
export interface SessionSettings {
  readonly cookieName: string;
  readonly cookieSecure: boolean;
  readonly cookieSameSite: 'lax' | 'strict' | 'none';
  readonly idleTimeoutMinutes: number;
  readonly absoluteLifetimeHours: number;
}

export const SESSION_SETTINGS = Symbol('SESSION_SETTINGS');
