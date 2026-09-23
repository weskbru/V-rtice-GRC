import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { FrameworkRegisterEmpty } from './framework-register-empty';

describe('FrameworkRegisterEmpty', () => {
  it('shows "no framework exists yet" (never "no results") when no filters are applied', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['compliance:view'] })}>
        <FrameworkRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum framework cadastrado')).toBeInTheDocument();
    expect(screen.queryByText(/filtros atuais/)).not.toBeInTheDocument();
  });

  it('offers "cadastrar framework" only to a user holding compliance:administer (advisory gating)', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['compliance:view'] })}>
        <FrameworkRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Cadastrar framework' })).not.toBeInTheDocument();

    render(
      <AuthProvider
        initialSession={buildTestSession({
          permissions: ['compliance:view', 'compliance:administer'],
        })}
      >
        <FrameworkRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    const createLink = screen.getByRole('link', { name: 'Cadastrar framework' });
    expect(createLink).toHaveAttribute('href', '/compliance/new');
  });

  it('shows "no results for these filters" (never "nothing yet") when filters are applied, and clears them on request', () => {
    const onClearFilters = vi.fn();
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['compliance:view'] })}>
        <FrameworkRegisterEmpty hasActiveFilters onClearFilters={onClearFilters} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum framework encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum framework cadastrado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
