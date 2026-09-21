import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { RiskRegisterEmpty } from './risk-register-empty';

/**
 * Component-mount evidence for T113 (FR-045, US3 AS7) — the two empty
 * states must be textually distinct and each drive its own next action.
 */
describe('RiskRegisterEmpty', () => {
  it('shows "no risk exists yet" (never "no results") when no filters are applied', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['risk:view'] })}>
        <RiskRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum risco cadastrado ainda')).toBeInTheDocument();
    expect(screen.queryByText(/filtros aplicados/)).not.toBeInTheDocument();
  });

  it('offers "create the first risk" only to a user holding risk:create (advisory gating)', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['risk:view'] })}>
        <RiskRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Criar o primeiro risco' })).not.toBeInTheDocument();

    render(
      <AuthProvider
        initialSession={buildTestSession({ permissions: ['risk:view', 'risk:create'] })}
      >
        <RiskRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    const createLink = screen.getByRole('link', { name: 'Criar o primeiro risco' });
    expect(createLink).toHaveAttribute('href', '/risks/new');
  });

  it('shows "no results for these filters" (never "nothing yet") when filters are applied, and clears them on request', () => {
    const onClearFilters = vi.fn();
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['risk:view'] })}>
        <RiskRegisterEmpty hasActiveFilters onClearFilters={onClearFilters} />
      </AuthProvider>,
    );

    expect(
      screen.getByText('Nenhum risco encontrado para os filtros aplicados'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nenhum risco cadastrado ainda')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar todos os filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
