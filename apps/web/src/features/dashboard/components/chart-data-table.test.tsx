import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChartDataTable } from './chart-data-table';

describe('ChartDataTable', () => {
  it('renders a visually-hidden table carrying every row and its exact value', () => {
    render(
      <ChartDataTable
        caption="Tabela: quantidade de riscos por nível"
        columnHeaders={['Nível', 'Quantidade']}
        rows={[
          { label: 'Baixo', value: 3 },
          { label: 'Crítico', value: 12 },
        ]}
      />,
    );

    const table = screen.getByRole('table', { name: 'Tabela: quantidade de riscos por nível' });

    expect(table).not.toHaveClass('sr-only');
    expect(table.parentElement).toHaveClass('sr-only');

    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText('Baixo')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('3')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Crítico')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('12')).toBeInTheDocument();
  });

  it('formats large values with pt-BR thousands separators', () => {
    render(
      <ChartDataTable
        caption="Tabela"
        columnHeaders={['Situação', 'Quantidade']}
        rows={[{ label: 'Total', value: 50000 }]}
      />,
    );

    expect(screen.getByText('50.000')).toBeInTheDocument();
  });
});
