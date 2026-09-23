import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IncidentRegisterSummary } from './incident-register-summary';

import type { DashboardSummaryResponse } from '@/features/dashboard/types';

const { getSummaryMock } = vi.hoisted(() => ({ getSummaryMock: vi.fn() }));

vi.mock('@/features/dashboard/api', () => ({
  dashboardApi: { getSummary: getSummaryMock },
}));

function summaryWithIncidents(byStatus: {
  OPEN: number;
  IN_PROGRESS: number;
  RESOLVED: number;
  CLOSED: number;
  CANCELLED: number;
}): DashboardSummaryResponse {
  return { metrics: [], breakdowns: { incidents: { byStatus } } };
}

describe('IncidentRegisterSummary', () => {
  it('renders each tile from the same breakdowns.incidents.byStatus response, with the total summing all five statuses', async () => {
    getSummaryMock.mockResolvedValue(
      summaryWithIncidents({ OPEN: 5, IN_PROGRESS: 3, RESOLVED: 2, CLOSED: 7, CANCELLED: 1 }),
    );
    render(<IncidentRegisterSummary />);

    await waitFor(() => expect(screen.getByText('18')).toBeInTheDocument());
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(getSummaryMock).toHaveBeenCalledTimes(1);
  });

  it('links each indicator to the exact register filter it summarizes', async () => {
    getSummaryMock.mockResolvedValue(
      summaryWithIncidents({ OPEN: 5, IN_PROGRESS: 3, RESOLVED: 2, CLOSED: 7, CANCELLED: 1 }),
    );
    render(<IncidentRegisterSummary />);

    await waitFor(() => expect(screen.getByText('18')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Ver todos os incidentes' })).toHaveAttribute(
      'href',
      '/incidents',
    );
    expect(screen.getByRole('link', { name: 'Ver incidentes abertos' })).toHaveAttribute(
      'href',
      '/incidents?status=OPEN',
    );
    expect(screen.getByRole('link', { name: 'Ver incidentes em andamento' })).toHaveAttribute(
      'href',
      '/incidents?status=IN_PROGRESS',
    );
    expect(screen.getByRole('link', { name: 'Ver incidentes resolvidos' })).toHaveAttribute(
      'href',
      '/incidents?status=RESOLVED',
    );
  });

  it('renders no strip at all — never zeros — when breakdowns.incidents is absent (no read permission)', async () => {
    getSummaryMock.mockResolvedValue({ metrics: [], breakdowns: {} });
    const { container } = render(<IncidentRegisterSummary />);

    await waitFor(() => expect(getSummaryMock).toHaveBeenCalledTimes(1));

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders only the quiet error line, with no indicator cards, when the request fails', async () => {
    getSummaryMock.mockRejectedValue(new Error('network down'));
    render(<IncidentRegisterSummary />);

    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar os indicadores.')).toBeInTheDocument(),
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
