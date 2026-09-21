import { render, screen } from '@testing-library/react';
import { CircleDashed } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { shell } from '@/lib/messages/shell';

import { NavigationRow } from './sidebar';

import type { PlannedNavigationEntry } from './navigation-registry';

/**
 * FR-043 — a `status: 'planned'` module is shown, explicitly labelled, and
 * NEVER rendered as a link to nowhere.
 *
 * This used to be asserted through `Sidebar` against whichever module
 * happened to be unbuilt at the time. The last such module was "Planos de
 * Ação", and it was removed once Action stopped being described as a
 * planned module at all (CLAUDE.md §1/§4/§17 — it is the shared `Action`
 * capability, and the live screen now carries that name). A guard whose
 * subject can disappear the moment the product ships a module was proving
 * the registry's current contents, not the renderer's contract.
 *
 * So the fixture is explicit here. `navigationRegistry` currently holds no
 * planned entry, and this test keeps working — and keeps failing for real
 * — either way. `navigation-registry.test.ts` covers the other half: that
 * every entry the registry DOES hold is well-formed for its own status.
 */
const plannedEntry: PlannedNavigationEntry = {
  id: 'future-module',
  label: 'Módulo futuro',
  icon: CircleDashed,
  status: 'planned',
};

describe('NavigationRow — planned entry (FR-043)', () => {
  it('renders a planned module as non-interactive, never as a link', () => {
    render(<NavigationRow entry={plannedEntry} collapsed={false} isActive={false} />);

    const label = screen.getByText('Módulo futuro');
    expect(label.closest('div[aria-disabled="true"]')).not.toBeNull();
    expect(screen.queryByRole('link', { name: /Módulo futuro/ })).toBeNull();
  });

  it('labels a planned module with the "Planejado" badge', () => {
    render(<NavigationRow entry={plannedEntry} collapsed={false} isActive={false} />);

    expect(screen.getByText(shell.sidebar.plannedBadge)).toBeInTheDocument();
  });

  it('keeps the planned state announced when the rail is collapsed and the label is hidden', () => {
    render(<NavigationRow entry={plannedEntry} collapsed isActive={false} />);

    // Collapsed hides the visible label AND the badge, so the only remaining
    // carrier of "this module does not exist yet" is the screen-reader text.
    // Losing it would leave a bare icon that looks like every other rail
    // item — the exact failure this assertion exists to catch.
    expect(screen.queryByText(shell.sidebar.plannedBadge)).toBeNull();
    expect(screen.getByText(shell.sidebar.plannedTitle('Módulo futuro'))).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
