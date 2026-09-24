'use client';

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

export function useOptionalNavigate(): Navigate | null {
  return useContext(NavigateContext);
}

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

export function LinkPendingSignal(): null {
  const { pending } = useLinkStatus();
  const report = useContext(PendingReporterContext);
  const signalId = useId();

  useEffect(() => {
    if (!report) return undefined;
    report(signalId, pending);
    return () => report(signalId, false);
  }, [report, signalId, pending]);

  return null;
}

export function NavigationPendingOverlay(): React.JSX.Element | null {
  const pending = useContext(NavigationPendingContext);
  const visible = useDelayedVisibility(pending);

  if (!visible) return null;

  return (
    <div
      data-navigation-pending=""
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 duration-200 animate-in fade-in motion-reduce:animate-none"
    >
      <div className="rounded-lg border border-border bg-card px-8 py-6 shadow-sm">
        <PharosLoader variant="page" label={shell.navigationPending} />
      </div>
    </div>
  );
}
