import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FrameworkRegisterFilters } from './framework-register-filters';

function baseProps() {
  return {
    origin: [] as const,
    onOriginChange: vi.fn(),
    searchValue: '',
    onSearchChange: vi.fn(),
    hasActiveFilters: false,
    activeFilterCount: 0,
    onClearFilters: vi.fn(),
  };
}

describe('FrameworkRegisterFilters', () => {
  it('keeps presentation controls beside search while the filter panel is collapsed', () => {
    render(
      <FrameworkRegisterFilters
        {...baseProps()}
        presentationControls={<button type="button">Alternar visualização</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Alternar visualização' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Origem' })).not.toBeInTheDocument();
  });

  it('renders no active-filter chip when nothing is applied', () => {
    render(<FrameworkRegisterFilters {...baseProps()} />);

    expect(screen.queryByText(/^Origem:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Busca:/)).not.toBeInTheDocument();
  });

  it('renders one chip per active filter field, and the badge count matches activeFilterCount', () => {
    render(
      <FrameworkRegisterFilters
        {...baseProps()}
        origin={['EXTERNAL_STANDARD']}
        searchValue="27001"
        hasActiveFilters
        activeFilterCount={2}
      />,
    );

    expect(screen.getByText('Busca: "27001"')).toBeInTheDocument();
    expect(screen.getByText('Origem: Norma externa')).toBeInTheDocument();
    const filtersToggle = screen.getByRole('button', { name: /Filtros/ });
    expect(filtersToggle).toHaveTextContent('2');
  });

  it('collapses two selected origins to a count chip, never two separate chips', () => {
    render(
      <FrameworkRegisterFilters
        {...baseProps()}
        origin={['EXTERNAL_STANDARD', 'INTERNAL_POLICY']}
        hasActiveFilters
        activeFilterCount={1}
      />,
    );

    expect(screen.getByText('Origem (2)')).toBeInTheDocument();
    expect(screen.queryByText('Origem: Norma externa')).not.toBeInTheDocument();
  });

  it('removing the origin chip clears only that field, leaving the search term untouched', () => {
    const onOriginChange = vi.fn();
    const onSearchChange = vi.fn();
    render(
      <FrameworkRegisterFilters
        {...baseProps()}
        origin={['EXTERNAL_STANDARD']}
        onOriginChange={onOriginChange}
        searchValue="27001"
        onSearchChange={onSearchChange}
        hasActiveFilters
        activeFilterCount={2}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Origem: Norma externa' }));

    expect(onOriginChange).toHaveBeenCalledWith([]);
    expect(onSearchChange).not.toHaveBeenCalled();
  });
});
