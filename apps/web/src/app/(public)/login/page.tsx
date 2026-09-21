/**
 * PharosGRC — login screen (T070, FR-047, SC-001).
 *
 * The first thing any user sees. Renders an accessible sign-in form
 * (`LoginForm`) inside a calm, enterprise card. A visitor who already holds
 * a valid session is sent straight to the dashboard rather than shown a
 * sign-in form they do not need (reuses the same server-side session check
 * `(app)/layout.tsx` uses, ADR-014).
 */
import { redirect } from 'next/navigation';

import { BrandMark } from '@/components/shell/brand-mark';
import { auth } from '@/lib/messages/auth';
import { fetchCurrentSession } from '@/lib/server-session';

import { LoginForm } from './login-form';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: auth.login.pageTitle,
};

/** Only a same-origin, absolute path is accepted — anything else falls back to `/dashboard` (never trust a redirect target from a query string). */
function sanitizeReturnTo(value: string | undefined): string {
  if (value && value.startsWith('/') && !value.startsWith('//') && !value.includes('://')) {
    return value;
  }
  return '/dashboard';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const existingSession = await fetchCurrentSession();
  if (existingSession) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const rawReturnTo = params.returnTo;
  const returnTo = sanitizeReturnTo(typeof rawReturnTo === 'string' ? rawReturnTo : undefined);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {/*
           * Brand mark — the same `BrandMark` the sidebar uses, sized up for a
           * sign-in card rather than a compact nav rail: [symbol] + live text per
           * CLAUDE.md §18.6, rather than an image of the full wordmark. It used to
           * inline the positive mark on a permanent white tile, which is the same
           * dark-theme defect the sidebar carried (see `brand-mark.tsx`'s header) —
           * one component now owns the per-theme asset choice for both.
           */}
          <BrandMark tileClassName="size-12" markClassName="size-7" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl font-semibold tracking-tight text-foreground">
              {auth.brand.name}
            </span>
            <p className="text-sm text-muted-foreground">{auth.brand.tagline}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-lg font-semibold text-foreground">{auth.login.heading}</h1>
          <p className="mb-6 text-sm text-muted-foreground">{auth.login.subheading}</p>
          <LoginForm returnTo={returnTo} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">{auth.login.footer}</p>
      </div>
    </div>
  );
}
