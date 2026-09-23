import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuditEngagementRegisterSummary } from './audit-engagement-register-summary';

import type { Page } from '../types';

const { listEngagementsMock } = vi.hoisted(() => ({ listEngagementsMock: vi.fn() }));

vi.mock('../api', () => ({
  auditEngagementsApi: { listEngagements: listEngagementsMock },
}));

function pageWithTotal(total: number): Page<never> {
  return { data: [], meta: { page: 1, pageSize: 1, total, totalPages: 1 } };
}

function mockCounts({
  total,
  planning,
  inProgress,
  completed,
}: {
  total: number;
  planning: number;
  inProgress: number;
  completed: number;
}): void {
  listEngagementsMock.mockImplementation((query: { status?: string }) => {
    if (query.status === 'PLANNING') return Promise.resolve(pageWithTotal(planning));
    if (query.status === 'IN_PROGRESS') return Promise.resolve(pageWithTotal(inProgress));
    if (query.status === 'COMPLETED') return Promise.resolve(pageWithTotal(completed));
    return Promise.resolve(pageWithTotal(total));
  });
}

describe('AuditEngagementRegisterSummary', () => {
  it('renders the exact figure for each of the four indicators, from the correctly filtered query', async () => {
    mockCounts({ total: 42, planning: 10, inProgress: 20, completed: 12 });
    render(<AuditEngagementRegisterSummary />);

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('links each indicator to the exact register filter it summarizes', async () => {
    mockCounts({ total: 42, planning: 10, inProgress: 20, completed: 12 });
    render(<AuditEngagementRegisterSummary />);

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Ver todos os engajamentos' })).toHaveAttribute(
      'href',
      '/audits',
    );
    expect(screen.getByRole('link', { name: 'Ver engajamentos em planejamento' })).toHaveAttribute(
      'href',
      '/audits?status=PLANNING',
    );
    expect(screen.getByRole('link', { name: 'Ver engajamentos em execução' })).toHaveAttribute(
      'href',
      '/audits?status=IN_PROGRESS',
    );
    expect(screen.getByRole('link', { name: 'Ver engajamentos concluídos' })).toHaveAttribute(
      'href',
      '/audits?status=COMPLETED',
    );
  });

  it('renders only the quiet error line, with no indicator cards, when the request fails', async () => {
    listEngagementsMock.mockRejectedValue(new Error('network down'));
    render(<AuditEngagementRegisterSummary />);

    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar os indicadores.')).toBeInTheDocument(),
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
