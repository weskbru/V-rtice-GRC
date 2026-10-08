import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IndicatorOverviewFilters } from './indicator-overview-filters';

const DOMAIN_OPTIONS = [
  { value: 'RISK' as const, count: 2 },
  { value: 'CONTROL' as const, count: 1 },
];

describe('IndicatorOverviewFilters', () => {
  it('renders a "Todos" segment with the full catalog count plus one segment per present domain', () => {
    render(
      <IndicatorOverviewFilters
        query=""
        onQueryChange={vi.fn()}
        totalCount={11}
        domainOptions={DOMAIN_OPTIONS}
        activeDomain="ALL"
        onDomainChange={vi.fn()}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Todos (11)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Riscos (2)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Controles (1)' })).toBeInTheDocument();
  });

  it('marks the active domain as checked, never only by colour', () => {
    render(
      <IndicatorOverviewFilters
        query=""
        onQueryChange={vi.fn()}
        totalCount={11}
        domainOptions={DOMAIN_OPTIONS}
        activeDomain="RISK"
        onDomainChange={vi.fn()}
        hasActiveFilters
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Riscos (2)' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Todos (11)' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('calls onDomainChange when a domain segment is activated by click', () => {
    const onDomainChange = vi.fn();
    render(
      <IndicatorOverviewFilters
        query=""
        onQueryChange={vi.fn()}
        totalCount={11}
        domainOptions={DOMAIN_OPTIONS}
        activeDomain="ALL"
        onDomainChange={onDomainChange}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Riscos (2)' }));
    expect(onDomainChange).toHaveBeenCalledWith('RISK');
  });

  it('is keyboard-operable — ArrowRight moves the selection to the next segment', () => {
    const onDomainChange = vi.fn();
    render(
      <IndicatorOverviewFilters
        query=""
        onQueryChange={vi.fn()}
        totalCount={11}
        domainOptions={DOMAIN_OPTIONS}
        activeDomain="ALL"
        onDomainChange={onDomainChange}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
      />,
    );

    const allSegment = screen.getByRole('radio', { name: 'Todos (11)' });
    allSegment.focus();
    fireEvent.keyDown(allSegment, { key: 'ArrowRight' });
    expect(onDomainChange).toHaveBeenCalledWith('RISK');
  });

  it('calls onQueryChange as the search box is typed into', () => {
    const onQueryChange = vi.fn();
    render(
      <IndicatorOverviewFilters
        query=""
        onQueryChange={onQueryChange}
        totalCount={11}
        domainOptions={DOMAIN_OPTIONS}
        activeDomain="ALL"
        onDomainChange={vi.fn()}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar indicadores' }), {
      target: { value: 'risco' },
    });
    expect(onQueryChange).toHaveBeenCalledWith('risco');
  });

  it('shows "Limpar filtros" only when a filter is active, and calls onClearFilters', () => {
    const onClearFilters = vi.fn();
    const { rerender } = render(
      <IndicatorOverviewFilters
        query=""
        onQueryChange={vi.fn()}
        totalCount={11}
        domainOptions={DOMAIN_OPTIONS}
        activeDomain="ALL"
        onDomainChange={vi.fn()}
        hasActiveFilters={false}
        onClearFilters={onClearFilters}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();

    rerender(
      <IndicatorOverviewFilters
        query="risco"
        onQueryChange={vi.fn()}
        totalCount={11}
        domainOptions={DOMAIN_OPTIONS}
        activeDomain="ALL"
        onDomainChange={vi.fn()}
        hasActiveFilters
        onClearFilters={onClearFilters}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
