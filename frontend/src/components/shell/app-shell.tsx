'use client';

import { AuthProvider } from '@/lib/auth-context';
import { shell } from '@/lib/messages/shell';

import { Header } from './header';
import { NavigationPendingOverlay, NavigationPendingProvider } from './navigation-pending';
import { PasswordChangeRequiredRedirect } from './password-change-required-redirect';
import { SessionExpiredDialog } from './session-expired-dialog';
import { Sidebar } from './sidebar';

import type { CurrentSession } from '@/lib/auth-types';

export interface AppShellProps {
  session: CurrentSession;
  children: React.ReactNode;
}

export function AppShell({ session, children }: AppShellProps): React.JSX.Element {
  return (
    <AuthProvider initialSession={session}>
      <NavigationPendingProvider>
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground focus-visible:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {shell.skipToContent}
        </a>
        <div data-app-shell className="flex h-svh w-full overflow-hidden bg-background">
          <Sidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Header />
            <div className="relative flex min-h-0 flex-1 flex-col">
              <main
                id="main-content"
                tabIndex={0}
                className="min-h-0 flex-1 overscroll-contain overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="mx-auto w-full max-w-(--layout-content-max-width) px-(--layout-page-padding-x-sm) py-6 lg:px-(--layout-page-padding-x-lg)">
                  {children}
                </div>
              </main>
              <NavigationPendingOverlay />
            </div>
          </div>
        </div>
        <SessionExpiredDialog />
        <PasswordChangeRequiredRedirect />
      </NavigationPendingProvider>
    </AuthProvider>
  );
}
