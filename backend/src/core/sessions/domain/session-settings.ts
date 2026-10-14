export interface SessionSettings {
  readonly cookieName: string;
  readonly cookieSecure: boolean;
  readonly cookieSameSite: 'lax' | 'strict' | 'none';
  readonly idleTimeoutMinutes: number;
  readonly absoluteLifetimeHours: number;
}

export const SESSION_SETTINGS = Symbol('SESSION_SETTINGS');
