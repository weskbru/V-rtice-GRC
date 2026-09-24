import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { risks } from '@/lib/messages/risks';

import { SortSelect } from './sort-select';

describe('SortSelect', () => {
  it('shows the preset matching the ordering in force', () => {
    render(
      <SortSelect
        labels={risks.register.results}
        sort="updatedAt"
        direction="desc"
        onSortChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveTextContent(
      'Mais recentes',
    );
  });

  it('composes an option for an ordering that is not one of the presets', () => {
    render(
      <SortSelect
        labels={risks.register.results}
        sort="title"
        direction="desc"
        onSortChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveTextContent(
      'Título (decrescente)',
    );
  });

  it('keeps the visible caption out of the control’s accessible name', () => {
    render(
      <SortSelect
        labels={risks.register.results}
        prefix={risks.register.results.sortLabel}
        sort="code"
        direction="asc"
        onSortChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText('Ordenar por').length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveAccessibleName(
      'Ordenar por',
    );
  });
});
