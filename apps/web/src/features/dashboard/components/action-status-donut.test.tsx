import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ActionStatusDonut } from './action-status-donut';

/**
 * The ring itself is SVG that jsdom cannot lay out (Recharts measures a
 * zero-size container here), so these assertions target the two channels a
 * reader actually depends on when colour is not enough: the visible legend,
 * which names every status with its count, and the screen-reader table.
 */
describe('ActionStatusDonut', () => {
  it('lists every status with its exact count in the table, including zeros', () => {
    render(
      <ActionStatusDonut byStatus={{ OPEN: 5, IN_PROGRESS: 0, COMPLETED: 30, CANCELLED: 2 }} />,
    );

    const table = screen.getByRole('table', { name: 'Tabela: quantidade de ações por status' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Aberta5',
      'Em andamento0',
      'Concluída30',
      'Cancelada2',
    ]);
  });

  it('keeps a zero status in the visible legend even though it has no arc', () => {
    const { container } = render(
      <ActionStatusDonut byStatus={{ OPEN: 5, IN_PROGRESS: 0, COMPLETED: 30, CANCELLED: 2 }} />,
    );

    const legendItems = container.querySelectorAll('ul > li');
    expect(legendItems).toHaveLength(4);
    expect(legendItems[1]?.textContent).toBe('Em andamento0');
  });

  it('shows the total of the four statuses it was given in the centre', () => {
    const { container } = render(
      <ActionStatusDonut byStatus={{ OPEN: 5, IN_PROGRESS: 4, COMPLETED: 30, CANCELLED: 2 }} />,
    );

    const centre = container.querySelector('.absolute');
    expect(centre?.textContent).toBe('41Total');
  });

  it('renders an empty scope as a real zero, not a missing chart', () => {
    const { container } = render(
      <ActionStatusDonut byStatus={{ OPEN: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 }} />,
    );

    expect(container.querySelector('.absolute')?.textContent).toBe('0Total');
    expect(container.querySelectorAll('ul > li')).toHaveLength(4);
  });
});
