import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProblemRegisterFilters } from './problem-register-filters';

/**
 * Component-mount evidence for `ProblemRegisterFilters` (CLAUDE.md §18.12)
 * — brought into the shared collapsible `FilterBar` disposition and the
 * shared chip builders (`@/lib/register/filter-chips`). The behaviour most
 * worth pinning down: an applied filter shows up as a removable chip, and
 * the chip's own remove button clears exactly that field.
 */
function renderFilters(
  overrides: Partial<React.ComponentProps<typeof ProblemRegisterFilters>> = {},
): {
  onStatusChange: ReturnType<typeof vi.fn>;
  onClearFilters: ReturnType<typeof vi.fn>;
} {
  const onStatusChange = vi.fn();
  const onClearFilters = vi.fn();
  render(
    <ProblemRegisterFilters
      status={['OPEN']}
      onStatusChange={onStatusChange}
      severity={[]}
      onSeverityChange={vi.fn()}
      searchValue=""
      onSearchChange={vi.fn()}
      hasActiveFilters
      activeFilterCount={1}
      onClearFilters={onClearFilters}
      {...overrides}
    />,
  );
  return { onStatusChange, onClearFilters };
}

describe('ProblemRegisterFilters', () => {
  it('shows a chip for the applied status filter, and clears it when removed', () => {
    const { onStatusChange } = renderFilters();

    const chip = screen.getByText('Status: Aberto');
    expect(chip).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Status: Aberto' }));
    expect(onStatusChange).toHaveBeenCalledWith([]);
  });

  it('places presentation controls beside the search field', () => {
    renderFilters({ presentationControls: <button type="button">Ordenar resultados</button> });
    expect(screen.getByRole('button', { name: 'Ordenar resultados' })).toBeVisible();
  });

  it('collapses two selected values of the same field into a count chip', () => {
    renderFilters({ status: ['OPEN', 'IN_ANALYSIS'], activeFilterCount: 1 });
    expect(screen.getByText('Status (2)')).toBeInTheDocument();
  });

  it('shows the "Filtros" disclosure button carrying the active filter count as a badge', () => {
    renderFilters();
    const toggle = screen.getByRole('button', { name: /Filtros/ });
    expect(toggle).toHaveTextContent('1');
  });

  it('shows no chip at all when no filter is applied', () => {
    renderFilters({ status: [], hasActiveFilters: false, activeFilterCount: 0 });
    expect(screen.queryByText(/Status/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Limpar filtros/ })).not.toBeInTheDocument();
  });
});
