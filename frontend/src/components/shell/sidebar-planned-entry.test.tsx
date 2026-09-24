import { render, screen } from '@testing-library/react';
import { CircleDashed } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { shell } from '@/lib/messages/shell';

import { NavigationRow } from './sidebar';

import type { PlannedNavigationEntry } from './navigation-registry';

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

    expect(screen.queryByText(shell.sidebar.plannedBadge)).toBeNull();
    expect(screen.getByText(shell.sidebar.plannedTitle('Módulo futuro'))).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
