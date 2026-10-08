import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MyActionsEmpty } from './my-actions-empty';

describe('MyActionsEmpty', () => {
  it('shows "no action assigned yet" (never "no results") when no filters are applied', () => {
    render(<MyActionsEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />);

    expect(screen.getByText('Nenhuma ação atribuída a você')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma ação encontrada')).not.toBeInTheDocument();
  });

  it('shows "no results for these filters" (never "nothing yet") when filters are applied, and clears them on request', () => {
    const onClearFilters = vi.fn();
    render(<MyActionsEmpty hasActiveFilters onClearFilters={onClearFilters} />);

    expect(screen.getByText('Nenhuma ação encontrada')).toBeInTheDocument();
    expect(screen.queryByText('Nenhuma ação atribuída a você')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
