'use client';

/**
 * PharosGRC application shell — theme provider (F-21, docs/deferred-findings.md).
 *
 * `packages/design-system` themes entirely through a `.dark` class on an
 * ancestor element and ships a complete, AA-measured dark palette — but
 * until this wave, nothing in `apps/web` ever mounted a provider or applied
 * that class, so the dark theme was unreachable dead code. This is a thin
 * wrapper around `next-themes` (already a dependency — `sonner.tsx`'s
 * `Toaster` already calls its `useTheme()`, expecting a provider that was
 * never mounted) rather than a bespoke implementation, per CLAUDE.md §18.4
 * ("no new component framework" — this is infrastructure, not a UI
 * framework, but the same restraint applies: don't hand-roll what an
 * existing, already-installed dependency does correctly).
 *
 * `attribute="class"` matches the design system's own `.dark` selector
 * (`@custom-variant dark (&:is(.dark *))`, `packages/design-system/src/styles/globals.css`).
 * `defaultTheme="system"` + `enableSystem` satisfy "respect the OS
 * preference by default"; `next-themes` persists an explicit user choice to
 * `localStorage` on its own once one is made (`ThemeToggle`).
 *
 * Flash-of-wrong-theme avoidance: `next-themes` injects a blocking inline
 * script that reads the persisted/system preference and sets the class
 * before the first paint — that only works if the surrounding `<html>`
 * carries `suppressHydrationWarning` (set in `app/layout.tsx`), since the
 * class next-themes applies before hydration will otherwise not match what
 * the server rendered and React would (harmlessly, but noisily) warn.
 */
import { ThemeProvider as NextThemesProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
