'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { apiClient } from './api-client';

import type { CurrentSession, EffectiveScope, OwnProfile, SessionMetadata } from './auth-types';
import type { ReactNode } from 'react';

export interface AuthContextValue {
  readonly user: OwnProfile;
  readonly permissions: readonly string[];
  readonly scope: EffectiveScope;
  readonly session: SessionMetadata;
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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      'useAuth() was called outside <AuthProvider> — it is only available within the authenticated app shell, apps/web/src/app/(app)/layout.tsx.',
    );
  }
  return context;
}
