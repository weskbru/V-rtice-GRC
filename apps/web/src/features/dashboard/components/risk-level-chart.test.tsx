import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RiskLevelChart } from './risk-level-chart';

describe('RiskLevelChart', () => {
  it('renders every risk level with its exact server-supplied count, never recomputed', () => {
    render(<RiskLevelChart byResidualLevel={{ LOW: 5, MEDIUM: 2, HIGH: 0, CRITICAL: 1 }} />);

    const table = screen.getByRole('table', {
      name: 'Tabela: quantidade de riscos por nível de risco residual',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual(['Baixo5', 'Médio2', 'Alto0', 'Crítico1']);
  });

  it('renders a genuine zero for every level as the ordinary case, not an error', () => {
    render(<RiskLevelChart byResidualLevel={{ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }} />);

    const table = screen.getByRole('table', {
      name: 'Tabela: quantidade de riscos por nível de risco residual',
    });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(within(row).getByText('0')).toBeInTheDocument();
    }
  });
});
