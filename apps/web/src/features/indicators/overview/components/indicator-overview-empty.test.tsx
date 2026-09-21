import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IndicatorOverviewEmpty } from './indicator-overview-empty';

describe('IndicatorOverviewEmpty', () => {
  it('explains that the filters excluded every indicator, with a "Limpar filtros" action', () => {
    const onClearFilters = vi.fn();
    render(<IndicatorOverviewEmpty onClearFilters={onClearFilters} />);

    expect(screen.getByText('Nenhum indicador encontrado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
