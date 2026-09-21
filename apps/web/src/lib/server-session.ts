import { cookies } from 'next/headers';

import { loadWebEnv } from './env';

import type { CurrentSession } from './auth-types';

/**
 * PharosGRC frontend — server-side session resolution (T072).
 *
 * ADR-014: React Server Components that need data call the API server-side,
 * forwarding the incoming request's cookie, rather than relying on a
 * client-side redirect (which would flash protected content first). This is
 * the one place `(app)/layout.tsx` and `(public)/login/page.tsx` resolve
 * "is there a valid session" — it calls `GET /auth/session` against
 * `API_INTERNAL_URL` directly (never through the `/api/*` rewrite, which
 * only exists for the browser).
 *
 * Returns `null` for "not authenticated" in every case — no cookie, an
 * expired/revoked session (401), or any other failure reaching the API.
 * Distinguishing *why* is not this function's job: both of its callers only
 * ever need a boolean.
 */
const SESSION_COOKIE_NAME = 'pgrc_session';

export async function fetchCurrentSession(): Promise<CurrentSession | null> {
  const cookieStore = await cookies();

  if (!cookieStore.get(SESSION_COOKIE_NAME)) {
    return null;
  }

  const { API_INTERNAL_URL } = loadWebEnv();

  let response: Response;
  try {
    response = await fetch(`${API_INTERNAL_URL}/api/v1/auth/session`, {
      headers: { cookie: cookieStore.toString() },
      cache: 'no-store',
    });
  } catch {
    // The API being unreachable is not this function's concern to surface —
    // callers treat it identically to "not authenticated" and redirect to
    // /login, which is the safe default.
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as CurrentSession;
}
