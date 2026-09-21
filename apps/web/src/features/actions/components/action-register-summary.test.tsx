import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActionRegisterSummary } from './action-register-summary';

import type { DashboardSummaryResponse } from '@/features/dashboard/types';

/**
 * Component-mount evidence for `ActionRegisterSummary` (CLAUDE.md §19.7) —
 * `@/features/dashboard/api` is mocked at the network boundary, mirroring
 * `risk-register-summary.test.tsx`'s own approach.
 *
 * The permission-gated-by-omission contract is the behaviour most worth
 * pinning down here: a caller without `action:view` never sees `breakdowns
 * .actions` on the wire, and this component must then render NO strip at
 * all — not a row of zeros, which would be a lie about what that caller can
 * see.
 */
const { getSummaryMock } = vi.hoisted(() => ({ getSummaryMock: vi.fn() }));

vi.mock('@/features/dashboard/api', () => ({
  dashboardApi: { getSummary: getSummaryMock },
}));

function summaryFixture(
  overrides: Partial<DashboardSummaryResponse['breakdowns']> = {},
): DashboardSummaryResponse {
  return {
    metrics: [],
    breakdowns: {
      actions: {
        byStatus: { OPEN: 12, IN_PROGRESS: 7, COMPLETED: 40, CANCELLED: 3 },
        dueSoon: 5,
        dueSoonWindowDays: 7,
      },
      ...overrides,
    },
  };
}

describe('ActionRegisterSummary', () => {
  it('renders the exact figure from breakdowns.actions for each of the four indicators', async () => {
    getSummaryMock.mockResolvedValueOnce(summaryFixture());
    render(<ActionRegisterSummary />);

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('links each indicator to the register filter it summarizes, with onlyMine=false so the number and the list it opens never disagree', async () => {
    getSummaryMock.mockResolvedValueOnce(summaryFixture());
    render(<ActionRegisterSummary />);

    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument());

    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por ações abertas' }),
    ).toHaveAttribute('href', '/actions?status=OPEN&onlyMine=false');
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por ações em andamento' }),
    ).toHaveAttribute('href', '/actions?status=IN_PROGRESS&onlyMine=false');
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por ações concluídas' }),
    ).toHaveAttribute('href', '/actions?status=COMPLETED&onlyMine=false');
  });

  it('renders NO strip at all — never a row of zeros — when breakdowns.actions is absent (no action:view)', async () => {
    getSummaryMock.mockResolvedValueOnce({ metrics: [], breakdowns: {} });
    const { container } = render(<ActionRegisterSummary />);

    await waitFor(() => expect(getSummaryMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders only the quiet error line, with no indicator cards, when the summary request fails', async () => {
    getSummaryMock.mockRejectedValueOnce(new Error('network down'));
    render(<ActionRegisterSummary />);

    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar os indicadores.')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
