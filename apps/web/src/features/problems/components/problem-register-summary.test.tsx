import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProblemRegisterSummary } from './problem-register-summary';

import type { DashboardSummaryResponse } from '@/features/dashboard/types';

/**
 * Component-mount evidence for `ProblemRegisterSummary` (CLAUDE.md §19.7) —
 * `@/features/dashboard/api` is mocked at the network boundary, mirroring
 * `risk-register-summary.test.tsx`'s own approach.
 *
 * The permission-gated-by-omission contract is the behaviour most worth
 * pinning down here: a caller without `problem:view` never sees `breakdowns
 * .problems` on the wire, and this component must then render NO strip at
 * all — not a row of zeros.
 */
const { getSummaryMock } = vi.hoisted(() => ({ getSummaryMock: vi.fn() }));

vi.mock('@/features/dashboard/api', () => ({
  dashboardApi: { getSummary: getSummaryMock },
}));

function summaryFixture(): DashboardSummaryResponse {
  return {
    metrics: [],
    breakdowns: {
      problems: {
        byStatus: { OPEN: 9, IN_ANALYSIS: 4, RESOLVED: 6, CLOSED: 21, CANCELLED: 2 },
      },
    },
  };
}

describe('ProblemRegisterSummary', () => {
  it('renders the exact figure from breakdowns.problems for each of the four indicators', async () => {
    getSummaryMock.mockResolvedValueOnce(summaryFixture());
    render(<ProblemRegisterSummary />);

    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
  });

  it('links each indicator to the register status filter it summarizes', async () => {
    getSummaryMock.mockResolvedValueOnce(summaryFixture());
    render(<ProblemRegisterSummary />);

    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());

    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por problemas abertos' }),
    ).toHaveAttribute('href', '/problems?status=OPEN');
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por problemas em análise' }),
    ).toHaveAttribute('href', '/problems?status=IN_ANALYSIS');
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por problemas resolvidos' }),
    ).toHaveAttribute('href', '/problems?status=RESOLVED');
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por problemas resolvidos' }),
    ).toHaveAttribute('data-tone', 'success');
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por problemas fechados' }),
    ).toHaveAttribute('href', '/problems?status=CLOSED');
  });

  it('renders NO strip at all — never a row of zeros — when breakdowns.problems is absent (no problem:view)', async () => {
    getSummaryMock.mockResolvedValueOnce({ metrics: [], breakdowns: {} });
    const { container } = render(<ProblemRegisterSummary />);

    await waitFor(() => expect(getSummaryMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders only the quiet error line, with no indicator cards, when the summary request fails', async () => {
    getSummaryMock.mockRejectedValueOnce(new Error('network down'));
    render(<ProblemRegisterSummary />);

    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar os indicadores.')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
