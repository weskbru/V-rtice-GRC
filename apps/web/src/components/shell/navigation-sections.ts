/**
 * PharosGRC application shell — presentational grouping over
 * `navigationRegistry` (T071).
 *
 * `Sidebar` and `Header` both need to say "this entry belongs to GRC" or
 * "this entry belongs to Administration" — but the registry itself (its own
 * header comment, and `navigation-registry.test.ts`) is the single named
 * extension point for *what a module is and how it is gated*, not for how it
 * is visually grouped. This module classifies an entry by its existing,
 * already-stable `id` (the registry's own doc comment: "used as the React
 * key and for test/id hooks") purely for rendering — it changes no entry's
 * meaning, gating or permission semantics (CLAUDE.md wave-2 brief).
 *
 * `dashboard` is deliberately its own, unlabelled top-level section — it is
 * cross-module (CLAUDE.md §11: "Dashboard GRC", not a dashboard exclusive to
 * one domain), not itself a GRC business module or an administrative one.
 */
import { shell } from '@/lib/messages/shell';

import type { NavigationEntry } from './navigation-registry';

export type NavigationSection = 'platform' | 'grc' | 'administration';

export function navigationSectionOf(entry: NavigationEntry): NavigationSection {
  if (entry.id === 'dashboard') {
    return 'platform';
  }
  return entry.id.startsWith('admin-') ? 'administration' : 'grc';
}

/** Visible section heading — `null` for `'platform'`, which renders with no header (see module doc). */
export const navigationSectionLabel: Record<NavigationSection, string | null> = {
  platform: null,
  grc: shell.sections.grc,
  administration: shell.sections.administration,
};
