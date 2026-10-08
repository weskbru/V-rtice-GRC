import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { ControlRegisterEmpty } from './control-register-empty';

describe('ControlRegisterEmpty', () => {
  it('shows "no control exists yet" (never "no results") when no filters are applied', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['control:view'] })}>
        <ControlRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum controle cadastrado')).toBeInTheDocument();
    expect(screen.queryByText(/filtros atuais/)).not.toBeInTheDocument();
  });

  it('offers "cadastrar controle" only to a user holding control:create (advisory gating)', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['control:view'] })}>
        <ControlRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Cadastrar controle' })).not.toBeInTheDocument();

    render(
      <AuthProvider
        initialSession={buildTestSession({ permissions: ['control:view', 'control:create'] })}
      >
        <ControlRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    const createLink = screen.getByRole('link', { name: 'Cadastrar controle' });
    expect(createLink).toHaveAttribute('href', '/controls/new');
  });

  it('shows "no results for these filters" (never "nothing yet") when filters are applied, and clears them on request', () => {
    const onClearFilters = vi.fn();
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['control:view'] })}>
        <ControlRegisterEmpty hasActiveFilters onClearFilters={onClearFilters} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum controle encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum controle cadastrado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
