import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { AuditEngagementRegisterEmpty } from './audit-engagement-register-empty';

describe('AuditEngagementRegisterEmpty', () => {
  it('shows "no engagement registered yet" (never "no results") when no filters are applied', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['audit-engagement:view'] })}>
        <AuditEngagementRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum engajamento de auditoria cadastrado')).toBeInTheDocument();
    expect(screen.queryByText(/filtros atuais/)).not.toBeInTheDocument();
  });

  it('offers "abrir engajamento" only to a user holding audit-engagement:create (advisory gating)', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['audit-engagement:view'] })}>
        <AuditEngagementRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Abrir engajamento' })).not.toBeInTheDocument();

    render(
      <AuthProvider
        initialSession={buildTestSession({
          permissions: ['audit-engagement:view', 'audit-engagement:create'],
        })}
      >
        <AuditEngagementRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    const createLink = screen.getByRole('link', { name: 'Abrir engajamento' });
    expect(createLink).toHaveAttribute('href', '/audits/new');
  });

  it('shows "no engagement matches these filters" (never "nothing yet") when filters are applied, and clears them on request', () => {
    const onClearFilters = vi.fn();
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['audit-engagement:view'] })}>
        <AuditEngagementRegisterEmpty hasActiveFilters onClearFilters={onClearFilters} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum engajamento encontrado')).toBeInTheDocument();
    expect(
      screen.queryByText('Nenhum engajamento de auditoria cadastrado'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
