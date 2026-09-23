import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RiskStatusChart } from './risk-status-chart';

import type { RiskStatus } from '@/features/risks/types';

describe('RiskStatusChart', () => {
  const byStatus: Record<RiskStatus, number> = {
    DRAFT: 1,
    IDENTIFIED: 2,
    ASSESSED: 3,
    UNDER_TREATMENT: 4,
    UNDER_REVIEW: 0,
    ACCEPTED: 5,
    CLOSED: 6,
    ARCHIVED: 0,
  };

  it('renders every status with its exact server-supplied count in the fixed lifecycle order', () => {
    render(<RiskStatusChart byStatus={byStatus} />);

    const table = screen.getByRole('table', { name: 'Tabela: quantidade de riscos por status' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Rascunho1',
      'Identificado2',
      'Avaliado3',
      'Em tratamento4',
      'Em revisão0',
      'Aceito5',
      'Encerrado6',
      'Arquivado0',
    ]);
  });

  it('renders a zero-count status as an ordinary, visible row — never a missing one (wave 3)', () => {
    render(<RiskStatusChart byStatus={byStatus} />);

    const table = screen.getByRole('table', { name: 'Tabela: quantidade de riscos por status' });
    const rows = within(table).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(8);
    const zeroRow = within(table).getByRole('rowheader', { name: 'Em revisão' }).closest('tr');
    expect(zeroRow).not.toBeNull();
    expect(within(zeroRow as HTMLElement).getByText('0')).toBeVisible();
  });
});
