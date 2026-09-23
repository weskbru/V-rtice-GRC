import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { replaceMock, listDefinitionsMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  listDefinitionsMock: vi.fn(),
}));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/reports',
  useSearchParams: () => currentSearch,
}));

vi.mock('../api', () => ({
  reportsApi: { listDefinitions: listDefinitionsMock, run: vi.fn(), buildRunCsvUrl: vi.fn() },
}));

import { ApiError } from '@/lib/api-client';
import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { ReportCatalogView } from './report-catalog-view';

function renderView(): void {
  render(
    <AuthProvider initialSession={buildTestSession({ permissions: ['report:view'] })}>
      <ReportCatalogView />
    </AuthProvider>,
  );
}

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
  listDefinitionsMock.mockReset();
});

describe('ReportCatalogView', () => {
  it('shows a loading state, then the catalog rows once the request resolves', async () => {
    listDefinitionsMock.mockResolvedValue({
      data: [
        {
          id: 'report-1',
          code: 'RPT-2026-0001',
          name: 'Painel executivo',
          description: 'Indicadores para a diretoria.',
          metricKeys: ['CONTROL_INACTIVE_COUNT'],
          isActive: true,
          createdBy: { id: 'user-1', fullName: 'Ada Analyst' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    renderView();

    expect(screen.getByText('Carregando dados…')).toBeInTheDocument();

    expect(await screen.findByText('Painel executivo')).toBeInTheDocument();
    expect(screen.getByText('1 indicador')).toBeInTheDocument();
  });

  it('shows the "no report created yet" empty state when the catalog is genuinely empty', async () => {
    listDefinitionsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });

    renderView();

    expect(await screen.findByText('Nenhum relatório criado')).toBeInTheDocument();
  });

  it('shows the error state with the server-supplied problem title on failure', async () => {
    listDefinitionsMock.mockRejectedValue(
      new ApiError({ title: 'Falha ao listar relatórios', status: 500 }),
    );

    renderView();

    expect(await screen.findByText('Falha ao listar relatórios')).toBeInTheDocument();
  });

  it('shows the matched-record count in the results toolbar once the request resolves', async () => {
    listDefinitionsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 42, totalPages: 1 },
    });

    renderView();

    expect(await screen.findByText('42 relatórios')).toBeInTheDocument();
  });

  it('collapses the Situação filter behind a "Filtros" disclosure, and shows a chip for an applied filter without opening it', async () => {
    currentSearch = new URLSearchParams('isActive=true');
    listDefinitionsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });

    renderView();
    await screen.findByText('0 relatórios');

    expect(screen.queryByLabelText('Situação')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /Filtros/ });
    expect(toggle).toHaveTextContent('1');
    expect(screen.getByText('Situação: Ativo')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByLabelText('Situação')).toBeInTheDocument();
  });
});
