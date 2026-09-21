'use client';

/**
 * PharosGRC — the dashboard's hero band (`025-dashboard-composition`).
 *
 * Replaces the platform-wide `PageHeader` on THIS screen only — every other
 * screen keeps `PageHeader` unchanged (CLAUDE.md §18.10).
 *
 * ## Not a card
 *
 * No `bg-card`, no border, no shadow: this band shares the page canvas
 * (`--background`), so it reads as part of the page rather than a component
 * sitting on it.
 *
 * The decorative SVG spans the band; its own fades protect the text.
 * On narrower screens only the low-contrast atmosphere and hills remain.
 *
 * ## "Olá, {nome}" uses the real signed-in identity
 *
 * `useAuth().user.fullName`, first word only — this component must render
 * under `AppShell` (same requirement `useAuth()` already documents).
 */
import { useAuth } from '@/lib/auth-context';
import { dashboard } from '@/lib/messages/dashboard';

import { DashboardHeroIllustration } from './dashboard-hero-illustration';
import { DashboardToday } from './dashboard-today';

/** First given name only — "Olá, Ada", never the full registered name. */
function firstName(fullName: string): string {
  const [first] = fullName.trim().split(/\s+/);
  return first ?? fullName;
}

export function DashboardHero(): React.JSX.Element {
  const { user } = useAuth();

  return (
    <header className="relative isolate overflow-hidden">
      <DashboardHeroIllustration />
      <div className="relative z-10 flex flex-col gap-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:py-8">
        <div className="flex flex-col gap-1 sm:max-w-xl">
          <p className="text-sm text-muted-foreground">
            {dashboard.greeting(firstName(user.fullName))}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {dashboard.pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{dashboard.description}</p>
        </div>
        <div className="shrink-0 sm:pt-1">
          <DashboardToday />
        </div>
      </div>
    </header>
  );
}
