import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ReportRegisterSummary } from './report-register-summary';

/**
 * Component-mount evidence for `ReportRegisterSummary` (CLAUDE.md §19.7) —
 * `reportsApi.listDefinitions` is mocked at the network boundary, mirroring
 * `asset-register-summary.test.tsx`'s own approach. Only TWO calls are ever
 * made (total, active) — the mock's default branch stands in for the
 * unfiltered "total" call, and "Inativos" is asserted as the SUBTRACTION,
 * never a third mocked `isActive=false` call, so a regression back to a
 * third request would leave that branch of the mock unreached and the
 * `mockCounts` total call count assertion below would fail.
 */
const { listDefinitionsMock } = vi.hoisted(() => ({ listDefinitionsMock: vi.fn() }));

vi.mock('../api', () => ({
  reportsApi: { listDefinitions: listDefinitionsMock },
}));

interface ListResponse {
  data: never[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

function pageWithTotal(total: number): ListResponse {
  return { data: [], meta: { page: 1, pageSize: 1, total, totalPages: 1 } };
}

function mockCounts({ total, active }: { total: number; active: number }): void {
  listDefinitionsMock.mockImplementation((query: { isActive?: boolean }) => {
    if (query.isActive === true) return Promise.resolve(pageWithTotal(active));
    return Promise.resolve(pageWithTotal(total));
  });
}

describe('ReportRegisterSummary', () => {
  it('renders the total and active figures from the server, and derives inactive by subtraction', async () => {
    mockCounts({ total: 45, active: 30 });
    render(<ReportRegisterSummary />);

    await waitFor(() => expect(screen.getByText('45')).toBeInTheDocument());
    expect(screen.getByText('30')).toBeInTheDocument();
    // 45 - 30 = 15, never independently fetched.
    expect(screen.getByText('15')).toBeInTheDocument();

    // Exactly two requests: one unfiltered, one `isActive: true`. A third
    // (`isActive: false`) would mean the subtraction was abandoned.
    expect(listDefinitionsMock).toHaveBeenCalledTimes(2);
    expect(listDefinitionsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
  });

  it('links each indicator to the exact register filter it summarizes', async () => {
    mockCounts({ total: 45, active: 30 });
    render(<ReportRegisterSummary />);

    await waitFor(() => expect(screen.getByText('45')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Ver todos os relatórios' })).toHaveAttribute(
      'href',
      '/reports',
    );
    expect(screen.getByRole('link', { name: 'Ver relatórios ativos' })).toHaveAttribute(
      'href',
      '/reports?isActive=true',
    );
    expect(screen.getByRole('link', { name: 'Ver relatórios inativos' })).toHaveAttribute(
      'href',
      '/reports?isActive=false',
    );
  });

  it('renders only the quiet error line, with no indicator cards, when the request fails', async () => {
    listDefinitionsMock.mockRejectedValue(new Error('network down'));
    render(<ReportRegisterSummary />);

    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar os indicadores.')).toBeInTheDocument(),
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
