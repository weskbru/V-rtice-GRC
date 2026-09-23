import { cookies } from 'next/headers';

import { loadWebEnv } from './env';

import type { CurrentSession } from './auth-types';

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
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as CurrentSession;
}
