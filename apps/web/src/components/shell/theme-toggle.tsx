'use client';

/**
 * PharosGRC application shell — theme toggle (F-21, docs/deferred-findings.md).
 *
 * Mounted in `Header`. Both icons always render; which one is visible is
 * decided purely by CSS reacting to the `.dark` ancestor class (the same
 * mechanism `packages/design-system` themes everything else through) rather
 * than by branching on `useTheme()`'s `resolvedTheme` — `resolvedTheme` is
 * `undefined` on the very first client render (next-themes cannot know the
 * theme before mount), so branching render output on it would either flash
 * the wrong icon or need a `mounted` guard. Reading it only inside the click
 * handler (a user gesture, always post-hydration) needs no such guard.
 */
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { shell } from '@/lib/messages/shell';

export function ThemeToggle(): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();

  function toggleTheme(): void {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative"
      onClick={toggleTheme}
      aria-label={shell.themeToggle.label}
      title={shell.themeToggle.label}
    >
      <Sun
        aria-hidden="true"
        className="size-5 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0"
      />
      <Moon
        aria-hidden="true"
        className="absolute size-5 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100"
      />
    </Button>
  );
}
