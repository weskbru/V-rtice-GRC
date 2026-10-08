import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { ReportRegisterEmpty } from './report-register-empty';

describe('ReportRegisterEmpty', () => {
  it('shows "no report created yet" (never "no results") when no filters are applied', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['report:view'] })}>
        <ReportRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );

    expect(screen.getByText('Nenhum relatório criado')).toBeInTheDocument();
  });

  it('offers "novo relatório" only to a user holding report:create (advisory gating)', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['report:view'] })}>
        <ReportRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Novo relatório' })).not.toBeInTheDocument();

    render(
      <AuthProvider
        initialSession={buildTestSession({ permissions: ['report:view', 'report:create'] })}
      >
        <ReportRegisterEmpty hasActiveFilters={false} onClearFilters={vi.fn()} />
      </AuthProvider>,
    );
    const createLink = screen.getByRole('link', { name: 'Novo relatório' });
    expect(createLink).toHaveAttribute('href', '/reports/new');
  });

  it('shows "no report matches these filters" (never "nothing yet") when filters are applied, and clears them on request', () => {
    const onClearFilters = vi.fn();
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['report:view'] })}>
        <ReportRegisterEmpty hasActiveFilters onClearFilters={onClearFilters} />
      </AuthProvider>,
    );

    expect(
      screen.getByText('Nenhum relatório encontrado para os filtros aplicados'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nenhum relatório criado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });
});
