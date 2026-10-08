import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RiskRegisterSummary } from './risk-register-summary';

import type { DashboardResponse } from '@/features/dashboard/types';

const { getDashboardMock } = vi.hoisted(() => ({ getDashboardMock: vi.fn() }));

vi.mock('@/features/dashboard/api', () => ({
  dashboardApi: { getDashboard: getDashboardMock },
}));

function dashboardFixture(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    risks: {
      total: 321,
      byResidualLevel: { LOW: 10, MEDIUM: 20, CRITICAL: 17, HIGH: 30 },
      byStatus: {
        DRAFT: 1,
        IDENTIFIED: 2,
        ASSESSED: 3,
        UNDER_TREATMENT: 44,
        UNDER_REVIEW: 4,
        ACCEPTED: 5,
        CLOSED: 6,
        ARCHIVED: 7,
      },
      link: { path: '/risks' },
    },
    pendingApprovals: { total: 0, items: [] },
    overdueActions: { total: 0, items: [], link: { path: '/risks?overdueTreatment=true' } },
    itemsRequiringReview: { total: 58, items: [], link: { path: '/risks?overdueReview=true' } },
    treatmentActions: { total: 0, open: 0, overdue: 0 },
    plannedAreas: [],
    ...overrides,
  };
}

describe('RiskRegisterSummary', () => {
  it('renders the exact figure from the dashboard response for each of the four indicators', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    render(<RiskRegisterSummary />);

    await waitFor(() => expect(screen.getByText('321')).toBeInTheDocument());

    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('44')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
  });

  it('links each indicator to the exact register filter it summarizes', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    render(<RiskRegisterSummary />);

    await waitFor(() => expect(screen.getByText('321')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Ver todos os riscos, sem filtros' })).toHaveAttribute(
      'href',
      '/risks',
    );
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por nível residual crítico' }),
    ).toHaveAttribute('href', '/risks?riskLevel=CRITICAL');
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por status em tratamento' }),
    ).toHaveAttribute('href', '/risks?status=UNDER_TREATMENT');
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por revisão vencida' }),
    ).toHaveAttribute('href', '/risks?overdueReview=true');
  });

  it('renders only the quiet error line, with no indicator cards, when the dashboard request fails', async () => {
    getDashboardMock.mockRejectedValueOnce(new Error('network down'));
    render(<RiskRegisterSummary />);

    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar os indicadores.')).toBeInTheDocument(),
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
