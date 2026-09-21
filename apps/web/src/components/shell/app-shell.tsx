'use client';

/**
 * PharosGRC application shell — the authenticated layout every future GRC
 * module renders inside unchanged (T072, T073, FR-039).
 *
 * `(app)/layout.tsx` resolves the session server-side (ADR-014) and passes
 * it in here; this component owns everything that needs to run in the
 * browser — the identity context, the sidebar/header chrome, and the
 * session-expiry seam.
 */
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
        {/*
         * Skip link (T203, WCAG 2.4.1) — the shell's first focusable element,
         * so a keyboard/screen-reader user can bypass the sidebar and header
         * (present on every authenticated screen) and reach the page's own
         * content directly. Hidden until it receives keyboard focus.
         */}
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground focus-visible:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {shell.skipToContent}
        </a>
        {/*
         * `data-app-shell` is what the base stylesheet keys the document-scroll
         * lock on (`packages/design-system/src/styles/globals.css`): where this
         * shell is mounted, `html`/`body` do not scroll and this element is the
         * whole viewport. Public pages carry no such marker and scroll normally.
         */}
        <div data-app-shell className="flex h-svh w-full overflow-hidden bg-background">
          <Sidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Header />
            {/* Positioned wrapper so the pending-navigation overlay covers exactly the main region — not the sidebar or header — and stays put while `<main>` scrolls beneath it. */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {/*
               * `id`/`tabIndex={0}` together satisfy two distinct things: the
               * skip link above needs a focusable target, and this region is
               * independently scrollable (`overflow-y-auto`) — axe's
               * `scrollable-region-focusable` rule (WCAG 2.1.1) requires a
               * scrollable container to itself be reachable by keyboard when it
               * has no focusable content of its own (e.g. the dashboard before
               * any module contributes an interactive card).
               *
               * `overscroll-contain` stops a wheel that reaches the end of this
               * region from chaining outwards — reaching the bottom of a page
               * and continuing to scroll must do nothing, never drag whatever
               * is behind the shell into view.
               */}
              <main
                id="main-content"
                tabIndex={0}
                className="min-h-0 flex-1 overscroll-contain overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {/*
                 * Content column (CLAUDE.md §18 Wave 2, layout tokens from
                 * `packages/design-system/src/tokens/spacing.ts` `layout`,
                 * mirrored as CSS vars in `../styles/globals.css`) — a page's
                 * content is centered and gutter-padded uniformly at the shell
                 * level, rather than each page choosing its own width/padding
                 * (previously nothing modeled this, which is why pages felt
                 * loosely placed). Pages themselves are not restyled here.
                 */}
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
