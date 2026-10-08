import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { ProcessRegisterEmpty } from './process-register-empty';

describe('ProcessRegisterEmpty', () => {
  it('shows "no process registered yet" (never "no results") when no filters are applied', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['process:view'] })}>
        <ProcessRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum processo cadastrado')).toBeInTheDocument();
    expect(screen.queryByText(/filtros atuais/)).not.toBeInTheDocument();
  });

  it('offers "cadastrar processo" only to a user holding process:create (advisory gating)', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['process:view'] })}>
        <ProcessRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Cadastrar processo' })).not.toBeInTheDocument();

    render(
      <AuthProvider
        initialSession={buildTestSession({ permissions: ['process:view', 'process:create'] })}
      >
        <ProcessRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    const createLink = screen.getByRole('link', { name: 'Cadastrar processo' });
    expect(createLink).toHaveAttribute('href', '/processes/new');
  });

  it('shows "no process matches these filters" (never "nothing yet") when filters are applied, and clears them on request', () => {
    const onClearFilters = vi.fn();
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['process:view'] })}>
        <ProcessRegisterEmpty hasActiveFilters onClearFilters={onClearFilters} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum processo encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum processo cadastrado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
