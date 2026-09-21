import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { IncidentRegisterEmpty } from './incident-register-empty';

/**
 * Component-mount evidence mirroring `asset-register-empty.test.tsx`
 * (008-incidents-problems, US1) — the two empty states must be textually
 * distinct and each drive its own next action (CLAUDE.md §18.11).
 */
describe('IncidentRegisterEmpty', () => {
  it('shows "no incident registered yet" (never "no results") when no filters are applied', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['incident:view'] })}>
        <IncidentRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum incidente registrado')).toBeInTheDocument();
    expect(screen.queryByText(/filtros atuais/)).not.toBeInTheDocument();
  });

  it('offers "registrar incidente" only to a user holding incident:create (advisory gating)', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['incident:view'] })}>
        <IncidentRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Registrar incidente' })).not.toBeInTheDocument();

    render(
      <AuthProvider
        initialSession={buildTestSession({ permissions: ['incident:view', 'incident:create'] })}
      >
        <IncidentRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    const createLink = screen.getByRole('link', { name: 'Registrar incidente' });
    expect(createLink).toHaveAttribute('href', '/incidents/new');
  });

  it('shows "no incident matches these filters" (never "nothing yet") when filters are applied, and clears them on request', () => {
    const onClearFilters = vi.fn();
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['incident:view'] })}>
        <IncidentRegisterEmpty hasActiveFilters onClearFilters={onClearFilters} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum incidente encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum incidente registrado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
