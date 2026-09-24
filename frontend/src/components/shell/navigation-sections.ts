import { shell } from '@/lib/messages/shell';

import type { NavigationEntry } from './navigation-registry';

export type NavigationSection = 'platform' | 'grc' | 'administration';

export function navigationSectionOf(entry: NavigationEntry): NavigationSection {
  if (entry.id === 'dashboard') {
    return 'platform';
  }
  return entry.id.startsWith('admin-') ? 'administration' : 'grc';
}

export const navigationSectionLabel: Record<NavigationSection, string | null> = {
  platform: null,
  grc: shell.sections.grc,
  administration: shell.sections.administration,
};
