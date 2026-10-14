import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSummaryMock, listDefinitionsMock, replaceMock } = vi.hoisted(() => ({
  getSummaryMock: vi.fn(),
  listDefinitionsMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock('@/features/dashboard/api', () => ({
  dashboardApi: { getSummary: getSummaryMock },
}));

vi.mock('../api', () => ({
  indicatorsApi: { listDefinitions: listDefinitionsMock },
}));

let currentSearch = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/indicators',
  useSearchParams: () => currentSearch,
}));

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { IndicatorCatalogView } from './indicator-catalog-view';

const FULL_SUMMARY = {
  metrics: [
    {
      metricKey: 'RISK_TOTAL_BY_LEVEL',
      shape: 'BY_BUCKET' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      valueByBucket: { LOW: 117, MEDIUM: 2, HIGH: 0, CRITICAL: 57 },
    },
    {
      metricKey: 'RISK_TREATMENT_OVERDUE_COUNT',
      shape: 'SINGLE_VALUE' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      value: 91,
    },
    {
      metricKey: 'CONTROL_INACTIVE_COUNT',
      shape: 'SINGLE_VALUE' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      value: 61,
    },
    {
      metricKey: 'COMPLIANCE_PERCENTAGE',
      shape: 'SINGLE_VALUE' as const,
      scopeApplicability: 'ORGANIZATION_WIDE' as const,
      value: 0,
    },
    {
      metricKey: 'AUDIT_ENGAGEMENT_OPEN_COUNT',
      shape: 'SINGLE_VALUE' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      value: 276,
    },
    {
      metricKey: 'FINDING_OPEN_COUNT_BY_SEVERITY',
      shape: 'BY_BUCKET' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      valueByBucket: { LOW: 359, MEDIUM: 3, HIGH: 3, CRITICAL: 0 },
    },
    {
      metricKey: 'ASSET_INACTIVE_COUNT',
      shape: 'SINGLE_VALUE' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      value: 2,
    },
    {
      metricKey: 'PROCESS_INACTIVE_COUNT',
      shape: 'SINGLE_VALUE' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      value: 3,
    },
    {
      metricKey: 'ACTION_OVERDUE_COUNT',
      shape: 'SINGLE_VALUE' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      value: 92,
    },
    {
      metricKey: 'INCIDENT_OPEN_COUNT_BY_SEVERITY',
      shape: 'BY_BUCKET' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      valueByBucket: { LOW: 3, MEDIUM: 1, HIGH: 212, CRITICAL: 0 },
    },
    {
      metricKey: 'PROBLEM_OPEN_COUNT_BY_SEVERITY',
      shape: 'BY_BUCKET' as const,
      scopeApplicability: 'ORGANIZATIONAL_UNIT' as const,
      valueByBucket: { LOW: 1, MEDIUM: 0, HIGH: 164, CRITICAL: 0 },
    },
  ],
  breakdowns: { indicators: { monitored: 2, breached: 1 } },
};

const EMPTY_DEFINITIONS = { data: [], meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 } };

function renderView(scopeGlobal = true): void {
  render(
    <AuthProvider
      initialSession={buildTestSession({ scope: { global: scopeGlobal, orgUnitIds: [] } })}
    >
      <IndicatorCatalogView />
    </AuthProvider>,
  );
}

beforeEach(() => {
  currentSearch = new URLSearchParams();
  replaceMock.mockClear();
  getSummaryMock.mockReset();
  listDefinitionsMock.mockReset();
});

describe('IndicatorCatalogView', () => {
  it('shows a single loading status while the batched summary request is in flight', () => {
    getSummaryMock.mockReturnValue(new Promise(() => undefined));
    listDefinitionsMock.mockReturnValue(new Promise(() => undefined));

    renderView();

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando indicadores…');
  });

  it('shows the error state, never a page of zeros, when the summary request fails', async () => {
    getSummaryMock.mockRejectedValue(new Error('network down'));
    listDefinitionsMock.mockResolvedValue(EMPTY_DEFINITIONS);

    renderView();

    expect(await screen.findByText('Não foi possível carregar os indicadores')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders the context band, both sections and one card per catalog key on a full, successful load', async () => {
    getSummaryMock.mockResolvedValue(FULL_SUMMARY);
    listDefinitionsMock.mockResolvedValue(EMPTY_DEFINITIONS);

    renderView();

    expect(await screen.findByText('11 indicadores')).toBeInTheDocument();
    expect(screen.getByText('Escopo: Organização inteira')).toBeInTheDocument();
    expect(
      screen.getByText('2 com limite configurado · 1 com limite rompido na última medição'),
    ).toBeInTheDocument();

    const distributionSection = screen.getByRole('region', {
      name: 'Composição por nível e severidade',
    });
    expect(within(distributionSection).getByText('Riscos por nível')).toBeInTheDocument();
    expect(
      within(distributionSection).getByText('Achados abertos por severidade'),
    ).toBeInTheDocument();
    expect(
      within(distributionSection).getByText('Incidentes abertos por severidade'),
    ).toBeInTheDocument();
    expect(
      within(distributionSection).getByText('Problemas abertos por severidade'),
    ).toBeInTheDocument();

    const singleValueSection = screen.getByRole('region', { name: 'Contagens e percentuais' });
    expect(within(singleValueSection).getByText('Controles inativos')).toBeInTheDocument();
    expect(within(singleValueSection).getByText('61')).toBeInTheDocument();
    expect(within(singleValueSection).getByText('0%')).toBeInTheDocument();
  });

  it('renders a compact "Requer permissão" card, never a zero, for a key the caller cannot read', async () => {
    const partialSummary = {
      ...FULL_SUMMARY,
      metrics: FULL_SUMMARY.metrics.filter(
        (metric) => metric.metricKey !== 'CONTROL_INACTIVE_COUNT',
      ),
    };
    getSummaryMock.mockResolvedValue(partialSummary);
    listDefinitionsMock.mockResolvedValue(EMPTY_DEFINITIONS);

    renderView();

    expect(
      await screen.findByText('10 de 11 disponíveis — 1 exige permissão do módulo de origem'),
    ).toBeInTheDocument();
    expect(screen.getByText('Requer permissão de Controles')).toBeInTheDocument();
  });

  it('activating a domain chip commits the URL filter (wiring only — the resulting narrowed render is covered by the "renders only the domain named in the URL" case below)', async () => {
    getSummaryMock.mockResolvedValue(FULL_SUMMARY);
    listDefinitionsMock.mockResolvedValue(EMPTY_DEFINITIONS);

    renderView();
    await screen.findByText('11 indicadores');

    fireEvent.click(screen.getByRole('radio', { name: 'Riscos (2)' }));
    expect(replaceMock).toHaveBeenCalledWith('/indicators?domain=RISK', { scroll: false });
  });

  it('renders only the domain named in the URL, with "Limpar filtros" available to leave it', async () => {
    currentSearch = new URLSearchParams('domain=RISK');
    getSummaryMock.mockResolvedValue(FULL_SUMMARY);
    listDefinitionsMock.mockResolvedValue(EMPTY_DEFINITIONS);

    renderView();

    expect(await screen.findByText('Riscos por nível')).toBeInTheDocument();
    expect(screen.getByText('Tratamentos de risco em atraso')).toBeInTheDocument();
    expect(screen.queryByText('Controles inativos')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(replaceMock).toHaveBeenCalledWith('/indicators', { scroll: false });
  });

  it("filters by the metric's own name as the search box is typed into", async () => {
    getSummaryMock.mockResolvedValue(FULL_SUMMARY);
    listDefinitionsMock.mockResolvedValue(EMPTY_DEFINITIONS);

    renderView();
    await screen.findByText('11 indicadores');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar indicadores' }), {
      target: { value: 'conformidade' },
    });
    expect(screen.getByText('Percentual de conformidade')).toBeInTheDocument();
    expect(screen.queryByText('Controles inativos')).not.toBeInTheDocument();
  });

  it('shows the empty-filtered state, with a working "Limpar filtros", when nothing matches', async () => {
    getSummaryMock.mockResolvedValue(FULL_SUMMARY);
    listDefinitionsMock.mockResolvedValue(EMPTY_DEFINITIONS);

    renderView();
    await screen.findByText('11 indicadores');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar indicadores' }), {
      target: { value: 'inexistente' },
    });
    expect(await screen.findByText('Nenhum indicador encontrado')).toBeInTheDocument();

    const clearButtons = screen.getAllByRole('button', { name: 'Limpar filtros' });
    const lastClearButton = clearButtons[clearButtons.length - 1];
    if (!lastClearButton) {
      throw new Error('expected at least one "Limpar filtros" button');
    }
    fireEvent.click(lastClearButton);
    expect(await screen.findByText('Controles inativos')).toBeInTheDocument();
  });

  it('shows the ORGANIZATION_WIDE scope note on the compliance card only for a unit-scoped caller', async () => {
    getSummaryMock.mockResolvedValue(FULL_SUMMARY);
    listDefinitionsMock.mockResolvedValue(EMPTY_DEFINITIONS);

    renderView(false);

    expect(
      await screen.findByText('Este indicador é sempre calculado para a organização inteira.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escopo: Unidades organizacionais do seu escopo')).toBeInTheDocument();
  });

  it('does not show the compliance scope note for a global-scoped caller (the band already covers it)', async () => {
    getSummaryMock.mockResolvedValue(FULL_SUMMARY);
    listDefinitionsMock.mockResolvedValue(EMPTY_DEFINITIONS);

    renderView(true);
    await screen.findByText('Percentual de conformidade');

    expect(
      screen.queryByText('Este indicador é sempre calculado para a organização inteira.'),
    ).not.toBeInTheDocument();
  });

  it('shows a note, never hides the screen, when the definitions request fails', async () => {
    getSummaryMock.mockResolvedValue(FULL_SUMMARY);
    listDefinitionsMock.mockRejectedValue(new Error('forbidden'));

    renderView();

    expect(
      await screen.findByText(
        'Não foi possível carregar os limites configurados agora — os valores acima continuam corretos.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('11 indicadores')).toBeInTheDocument();
  });
});
