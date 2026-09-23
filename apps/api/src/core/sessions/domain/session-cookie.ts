import { createHash, randomBytes } from 'node:crypto';

import type { SessionSettings } from './session-settings';

const TOKEN_BYTES = 32;

export function generateOpaqueSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

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
