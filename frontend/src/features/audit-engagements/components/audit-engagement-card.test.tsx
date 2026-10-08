import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuditEngagementCard } from './audit-engagement-card';

import type { AuditEngagement } from '../types';

const engagement: AuditEngagement = {
  id: 'audit-1',
  code: 'AUD-2026-0001',
  objective: 'Avaliar a efetividade dos controles de acesso',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  orgUnit: { id: 'unit-1', name: 'Tecnologia' },
  leadAuditor: { id: 'user-1', fullName: 'Marina Costa' },
  status: 'IN_PROGRESS',
  startedAt: '2026-09-02T12:00:00.000Z',
  startedBy: { id: 'user-1', fullName: 'Marina Costa' },
  completedAt: null,
  completedBy: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationJustification: null,
  version: 2,
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-12T12:00:00.000Z',
};

describe('AuditEngagementCard', () => {
  it('preserves the engagement information and direct detail navigation', () => {
    render(<AuditEngagementCard engagement={engagement} />);

    expect(screen.getByRole('link', { name: 'AUD-2026-0001' })).toHaveAttribute(
      'href',
      '/audits/audit-1',
    );
    expect(
      screen.getByRole('link', {
        name: 'Abrir engajamento AUD-2026-0001 — Avaliar a efetividade dos controles de acesso',
      }),
    ).toHaveAttribute('href', '/audits/audit-1');
    expect(screen.getByText('Em execução')).toBeInTheDocument();
    expect(screen.getByText('Tecnologia')).toBeInTheDocument();
    expect(screen.getByText('Marina Costa')).toBeInTheDocument();
    expect(screen.getByText('01/09/2026 a 30/09/2026')).toBeInTheDocument();
    expect(screen.getByText('Atualizado em 12/09/2026')).toBeInTheDocument();
  });

  it('uses the existing status mapper as the card accent source', () => {
    const { container, rerender } = render(<AuditEngagementCard engagement={engagement} />);

    expect(container.querySelector('article')).toHaveAttribute('data-tone', 'info');

    rerender(<AuditEngagementCard engagement={{ ...engagement, status: 'COMPLETED' }} />);
    expect(container.querySelector('article')).toHaveAttribute('data-tone', 'success');

    rerender(<AuditEngagementCard engagement={{ ...engagement, status: 'PLANNING' }} />);
    expect(container.querySelector('article')).toHaveAttribute('data-tone', 'neutral');
  });
});
