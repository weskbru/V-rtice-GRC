'use client';

/**
 * PharosGRC — pending-navigation feedback for the authenticated shell
 * (`specs/014-institutional-loader`).
 *
 * Two signals, both the router's own, aggregated into one overlay:
 *
 * 1. **`useLinkStatus()`** (Next 15.3+), read by `LinkPendingSignal` from
 *    inside the `<Link>` that started the navigation. It is `pending` for
 *    exactly as long as that navigation is in flight, and the router itself
 *    reverts it — on commit, when a newer navigation supersedes it, and when
 *    it fails. Every link in the product gets this by construction, because
 *    `@/components/navigation/link` is the only `<Link>` the product imports
 *    (an ESLint rule enforces it).
 * 2. **`useTransition()` around `router.push`**, owned by THIS provider and
 *    handed out as `useNavigate()`. It covers navigation the product performs
 *    itself — after creating a record, on sign-out, on session expiry — which
 *    no link is involved in. The transition lives in the provider, which never
 *    unmounts, so the screen that triggered the navigation can be replaced
 *    without losing the signal.
 *
 * There is no click listener, no history patching, no router state kept in
 * parallel: nothing here decides whether a navigation is happening, it only
 * asks the router.
 *
 * `NavigationPendingOverlay` turns "some navigation is pending" into a light
 * overlay over `<main>` — the previous screen stays visible beneath it — only
 * after `useDelayedVisibility`'s delay, so a fast navigation shows nothing.
 *
 * ## Why not `loading.tsx`
 *
 * `app/(app)/loading.tsx` is the native route-level mechanism and it does
 * cover every navigation origin — but measured against this product's own
 * production build (`specs/014-institutional-loader` §2.2) it is incompatible
 * with the approved behaviour in three ways at once: it painted its fallback
 * 67 ms after a click and removed it 32 ms later on a fast navigation (the
 * flash the delay exists to prevent, and it has no delay of its own); it
 * REPLACED the outgoing screen (`<main>` measured as the fallback's text)
 * rather than overlaying it; and because the loading boundary commits the
 * navigation immediately, `useLinkStatus` went back to `false` at once and the
 * institutional overlay never appeared at all. It would not be a second
 * indicator alongside this one — it would silently replace it.
 *
 * Separate contexts on purpose: every link reads only the stable `report`
 * function, so a change in the pending state re-renders the overlay and not
 * every link on the screen.
 */
import { PharosLoader, useDelayedVisibility } from '@pharos/design-system/components';
import { useLinkStatus } from 'next/link';
// eslint-disable-next-line no-restricted-imports -- this module IS the product's navigation primitive; `useNavigate` below is what every other module uses instead of `useRouter`.
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from 'react';

import { shell } from '@/lib/messages/shell';

type PendingReporter = (signalId: string, pending: boolean) => void;

/**
 * Navigates to `href`, reporting the wait to the shell's overlay. Mirrors the
 * `router.push`/`replace`/`back`/`refresh` it replaces, one to one, so a call
 * site reads the same after migrating.
 *
 * `refresh` is included because re-rendering the current route from the server
 * is the same kind of wait — the user is looking at a screen that is being
 * replaced by a newer version of itself.
 */
export interface Navigate {
  (href: string, options?: { readonly replace?: boolean }): void;
  readonly back: () => void;
  readonly refresh: () => void;
}

const PendingReporterContext = createContext<PendingReporter | null>(null);
const NavigationPendingContext = createContext(false);
const NavigateContext = createContext<Navigate | null>(null);

export function NavigationPendingProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const [pendingSignals, setPendingSignals] = useState<ReadonlySet<string>>(() => new Set());
  const [isNavigating, startNavigation] = useTransition();

  const report = useCallback<PendingReporter>((signalId, pending) => {
    setPendingSignals((current) => {
      if (current.has(signalId) === pending) return current;
      const next = new Set(current);
      if (pending) next.add(signalId);
      else next.delete(signalId);
      return next;
    });
  }, []);

  const navigate = useMemo<Navigate>(() => {
    const go: Navigate = Object.assign(
      (href: string, options?: { readonly replace?: boolean }) => {
        startNavigation(() => {
          if (options?.replace) router.replace(href);
          else router.push(href);
        });
      },
      {
        back: () => startNavigation(() => router.back()),
        refresh: () => startNavigation(() => router.refresh()),
      },
    );
    return go;
  }, [router]);

  return (
    <PendingReporterContext.Provider value={report}>
      <NavigateContext.Provider value={navigate}>
        <NavigationPendingContext.Provider value={pendingSignals.size > 0 || isNavigating}>
          {children}
        </NavigationPendingContext.Provider>
      </NavigateContext.Provider>
    </PendingReporterContext.Provider>
  );
}

/**
 * The shell's own `navigate`, or `null` when there is no shell around this
 * component — the sign-in screen, and every component test that renders a
 * fragment of a screen on its own.
 *
 * Separate from `useNavigate` because it touches NO router: `@/components/
 * navigation/link` is rendered by nearly every screen, and making the
 * product's `<Link>` depend on `useRouter()` would force a router mock into
 * every test that renders anything containing a link (measured: 119 failures
 * across 18 files). A link with no shell to report to simply behaves like a
 * plain `next/link`.
 */
export function useOptionalNavigate(): Navigate | null {
  return useContext(NavigateContext);
}

/**
 * The product's imperative navigation, in place of `useRouter().push`.
 *
 * Outside the authenticated shell (the sign-in screen) there is no provider
 * and no overlay to feed, so this degrades to a plain `router.push` — the
 * navigation still happens, it simply shows nothing.
 *
 * Deliberately NOT a replacement for `router.replace()` used to write the
 * current screen's own query string (filters, sorting, pagination): that is
 * not a navigation between screens, and covering it would put a page-level
 * loader over a filter change.
 */
export function useNavigate(): Navigate {
  const contextual = useContext(NavigateContext);
  const router = useRouter();

  return useMemo<Navigate>(() => {
    if (contextual) return contextual;
    return Object.assign(
      (href: string, options?: { readonly replace?: boolean }) => {
        if (options?.replace) router.replace(href);
        else router.push(href);
      },
      { back: () => router.back(), refresh: () => router.refresh() },
    );
  }, [contextual, router]);
}

/** Render inside a `<Link>`: forwards that link's own `useLinkStatus().pending` to the shell. Renders nothing. */
export function LinkPendingSignal(): null {
  const { pending } = useLinkStatus();
  const report = useContext(PendingReporterContext);
  const signalId = useId();

  useEffect(() => {
    if (!report) return undefined;
    report(signalId, pending);
    // Unmounting mid-navigation (the link's own screen replaced) must not leave a pending entry behind.
    return () => report(signalId, false);
  }, [report, signalId, pending]);

  return null;
}

/**
 * Covers the positioned region it is placed in (the shell's `<main>` wrapper).
 * It blocks pointer interaction with the outgoing screen while shown, but the
 * sidebar stays usable, so a second navigation can always supersede the first.
 */
export function NavigationPendingOverlay(): React.JSX.Element | null {
  const pending = useContext(NavigationPendingContext);
  const visible = useDelayedVisibility(pending);

  if (!visible) return null;

  return (
    <div
      data-navigation-pending=""
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 duration-200 animate-in fade-in motion-reduce:animate-none"
    >
      {/*
       * A quiet surface under the mark, not decoration: the veil alone leaves
       * the outgoing screen readable enough that at 390px the symbol landed on
       * top of a card's own title (verified renderizado, docs/reviews/ui/loader).
       * One flat card is what makes the indicator legible over arbitrary
       * content without blanking what is underneath.
       */}
      <div className="rounded-lg border border-border bg-card px-8 py-6 shadow-sm">
        <PharosLoader variant="page" label={shell.navigationPending} />
      </div>
    </div>
  );
}
