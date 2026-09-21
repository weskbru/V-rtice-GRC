'use client';

/**
 * PharosGRC frontend — authenticated identity context (T072, T077, T078).
 *
 * `AppShell` (`src/components/shell/app-shell.tsx`) is the single mount
 * point: `(app)/layout.tsx` resolves the session server-side (forwarding the
 * request's cookie, per ADR-014) and seeds this context so every screen
 * under `(app)/` reads the signed-in user, their advisory permission set
 * (`src/lib/permissions.ts`) and session metadata without re-fetching on
 * every navigation.
 *
 * This context is a read model only. It never decides what a user may do —
 * per ADR-003 that is the server's job on every request, unconditionally.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { apiClient } from './api-client';

import type { CurrentSession, EffectiveScope, OwnProfile, SessionMetadata } from './auth-types';
import type { ReactNode } from 'react';

export interface AuthContextValue {
  readonly user: OwnProfile;
  /** Effective `resource:action` permissions (ADR-003). Prefer `usePermissions()` over reading this directly. */
  readonly permissions: readonly string[];
  readonly scope: EffectiveScope;
  readonly session: SessionMetadata;
  /**
   * Re-fetches `GET /auth/session` and replaces the context value. Used
   * after in-place re-authentication (`SessionExpiredDialog`) so the shell
   * reflects the freshly issued session without a full page reload — the
   * page underneath, and anything the user typed on it, is never touched.
   */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  initialSession: CurrentSession;
  children: ReactNode;
}

export function AuthProvider({ initialSession, children }: AuthProviderProps): React.JSX.Element {
  const [session, setSession] = useState<CurrentSession>(initialSession);

  const refresh = useCallback(async () => {
    // Session-expiry handling itself must never be re-triggered by this call.
    const next = await apiClient.get<CurrentSession>('/auth/session', {
      skipUnauthorizedHandler: true,
    });
    setSession(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      permissions: session.permissions,
      scope: session.scope,
      session: session.session,
      refresh,
    }),
    [session, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Reads the current user's identity, advisory permissions and session metadata. Must be called under `AppShell` (i.e. within `(app)/`). */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      'useAuth() was called outside <AuthProvider> — it is only available within the authenticated app shell, apps/web/src/app/(app)/layout.tsx.',
    );
  }
  return context;
}
