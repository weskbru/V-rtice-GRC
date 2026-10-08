import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/features/reports/api', () => ({
  reportsApi: { createDefinition: vi.fn() },
}));

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import NewReportPage from './page';

describe('NewReportPage', () => {
  it('renders a permission-denied state for a caller with only report:view', () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: ['report:view'] })}>
        <NewReportPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Sem permissão para criar relatórios')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Nome/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para Relatórios' })).toHaveAttribute(
      'href',
      '/reports',
    );
  });

  it('renders the creation form for a caller holding report:create', () => {
    render(
      <AuthProvider
        initialSession={buildTestSession({ permissions: ['report:view', 'report:create'] })}
      >
        <NewReportPage />
      </AuthProvider>,
    );

    expect(screen.getByLabelText(/^Nome/)).toBeInTheDocument();
    expect(screen.queryByText('Sem permissão para criar relatórios')).not.toBeInTheDocument();
  });
});
