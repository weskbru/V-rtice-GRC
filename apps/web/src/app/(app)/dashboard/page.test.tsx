import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import DashboardPage from './page';

import type {
  DashboardBreakdowns,
  DashboardResponse,
  DashboardSummaryMetric,
  DashboardSummaryResponse,
} from '@/features/dashboard/types';

const { getDashboardMock, getSummaryMock } = vi.hoisted(() => ({
  getDashboardMock: vi.fn(),
  getSummaryMock: vi.fn(),
}));

vi.mock('@/features/dashboard/api', () => ({
  dashboardApi: { getDashboard: getDashboardMock, getSummary: getSummaryMock },
}));

const ZERO_BY_STATUS = {
  DRAFT: 0,
  IDENTIFIED: 0,
  ASSESSED: 0,
  UNDER_TREATMENT: 0,
  UNDER_REVIEW: 0,
  ACCEPTED: 0,
  CLOSED: 0,
  ARCHIVED: 0,
} as const;

function dashboardFixture(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    risks: {
      total: 999,
      byResidualLevel: { LOW: 1, MEDIUM: 2, HIGH: 1, CRITICAL: 17 },
      byStatus: { ...ZERO_BY_STATUS, DRAFT: 1 },
      link: { path: '/risks' },
    },
    pendingApprovals: { total: 3, items: [] },
    overdueActions: { total: 2, items: [], link: { path: '/risks?overdueTreatment=true' } },
    itemsRequiringReview: { total: 5, items: [], link: { path: '/risks?overdueReview=true' } },
    treatmentActions: { total: 40, open: 7, overdue: 1 },
    plannedAreas: [],
    ...overrides,
  };
}

function zeroDashboardFixture(): DashboardResponse {
  return dashboardFixture({
    risks: {
      total: 0,
      byResidualLevel: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      byStatus: ZERO_BY_STATUS,
      link: { path: '/risks' },
    },
    pendingApprovals: { total: 0, items: [] },
    overdueActions: { total: 0, items: [], link: { path: '/risks?overdueTreatment=true' } },
    itemsRequiringReview: { total: 0, items: [], link: { path: '/risks?overdueReview=true' } },
    treatmentActions: { total: 0, open: 0, overdue: 0 },
  });
}

function single(metricKey: string, value: number | undefined): DashboardSummaryMetric {
  return {
    metricKey,
    shape: 'SINGLE_VALUE',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    ...(value === undefined ? {} : { value }),
  };
}

function buckets(metricKey: string, valueByBucket: Record<string, number>): DashboardSummaryMetric {
  return {
    metricKey,
    shape: 'BY_BUCKET',
    scopeApplicability: 'ORGANIZATIONAL_UNIT',
    valueByBucket,
  };
}

function fullMetrics(): DashboardSummaryMetric[] {
  return [
    single('ACTION_OVERDUE_COUNT', 11),
    buckets('INCIDENT_OPEN_COUNT_BY_SEVERITY', { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }),
    buckets('PROBLEM_OPEN_COUNT_BY_SEVERITY', { CRITICAL: 0, HIGH: 6, MEDIUM: 0, LOW: 0 }),
    single('CONTROL_INACTIVE_COUNT', 8),
    {
      metricKey: 'COMPLIANCE_PERCENTAGE',
      shape: 'SINGLE_VALUE',
      scopeApplicability: 'ORGANIZATION_WIDE',
      value: 62.5,
    },
    single('AUDIT_ENGAGEMENT_OPEN_COUNT', 13),
    buckets('FINDING_OPEN_COUNT_BY_SEVERITY', { LOW: 20, MEDIUM: 1, HIGH: 0, CRITICAL: 0 }),
  ];
}

function fullBreakdowns(): DashboardBreakdowns {
  return {
    actions: {
      byStatus: { OPEN: 5, IN_PROGRESS: 4, COMPLETED: 30, CANCELLED: 2 },
      dueSoon: 6,
      dueSoonWindowDays: 7,
    },
    incidents: { byStatus: { OPEN: 3, IN_PROGRESS: 5, RESOLVED: 1, CLOSED: 9, CANCELLED: 0 } },
    problems: { byStatus: { OPEN: 2, IN_ANALYSIS: 7, RESOLVED: 0, CLOSED: 1, CANCELLED: 0 } },
    controls: { total: 40, active: 31, ineffective: 3 },
    compliance: {
      requirementCount: 25,
      byState: { NOT_APPLICABLE: 2, NOT_MET: 4, NOT_PROVEN: 6, PARTIALLY_MET: 3, COMPLIANT: 10 },
    },
    indicators: { monitored: 11, breached: 2 },
  };
}

function fullSummary(): DashboardSummaryResponse {
  return { metrics: fullMetrics(), breakdowns: fullBreakdowns() };
}

const EVERYTHING = [
  'risk:view',
  'risk:approve',
  'risk:create',
  'incident:create',
  'problem:create',
  'action:view',
];

function renderDashboard(permissions: readonly string[] = EVERYTHING) {
  return render(
    <AuthProvider initialSession={buildTestSession({ permissions: [...permissions] })}>
      <DashboardPage />
    </AuthProvider>,
  );
}

function cardFor(heading: string): HTMLElement {
  const card = screen.getByRole('heading', { name: heading }).closest('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) {
    throw new Error(`No card found for heading "${heading}"`);
  }
  return card;
}

function statValue(heading: string): string {
  return cardFor(heading).querySelector('p.text-3xl')?.textContent ?? '';
}

function moduleValue(heading: string, rowLabel: string): string {
  const term = within(cardFor(heading)).getByText(rowLabel, { selector: 'dt' });
  return term.nextElementSibling?.textContent ?? '';
}

async function waitForLoaded(): Promise<void> {
  await waitFor(() => expect(screen.getByText('Riscos por nível (residual)')).toBeInTheDocument());
}

describe('DashboardPage', () => {
  beforeEach(() => {
    getDashboardMock.mockReset();
    getSummaryMock.mockReset();
  });

  it('renders every attention figure exactly as the endpoints returned it', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValueOnce(fullSummary());
    renderDashboard();
    await waitForLoaded();

    expect(statValue('Aprovações pendentes')).toBe('3');
    expect(statValue('Ações atrasadas')).toBe('11');
    expect(statValue('Ações vencendo em breve')).toBe('6');
    expect(
      within(cardFor('Ações vencendo em breve')).getByText('prazo nos próximos 7 dias'),
    ).toBeInTheDocument();
    expect(statValue('Riscos para revisão')).toBe('5');
    expect(
      screen.queryByRole('heading', { name: 'Indicadores em alerta' }),
    ).not.toBeInTheDocument();
  });

  it('totals only what arrived together, to the exact expected figure', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValueOnce(fullSummary());
    renderDashboard();
    await waitForLoaded();

    expect(statValue('Incidentes abertos')).toBe('10');
    expect(within(cardFor('Incidentes abertos')).getByText('4 críticos')).toBeInTheDocument();
    expect(statValue('Problemas pendentes')).toBe('9');
    expect(moduleValue('Planos de Ação', 'Em aberto')).toBe('9');
    expect(moduleValue('Incidentes', 'Abertos')).toBe('10');
    expect(moduleValue('Auditoria', 'Achados')).toBe('21');
  });

  it('renders every module figure exactly as the endpoints returned it', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValueOnce(fullSummary());
    renderDashboard();
    await waitForLoaded();

    expect(moduleValue('Riscos', 'Total')).toBe('999');
    expect(moduleValue('Riscos', 'Altos')).toBe('1');
    expect(moduleValue('Riscos', 'Críticos')).toBe('17');

    expect(moduleValue('Planos de Ação', 'Atrasadas')).toBe('11');
    expect(moduleValue('Planos de Ação', 'Vencendo')).toBe('6');

    expect(moduleValue('Incidentes', 'Críticos')).toBe('4');
    expect(moduleValue('Incidentes', 'Em andamento')).toBe('5');

    expect(moduleValue('Problemas', 'Abertos')).toBe('6');
    expect(moduleValue('Problemas', 'Em análise')).toBe('7');
    expect(moduleValue('Problemas', 'Críticos')).toBe('0');

    expect(moduleValue('Controles', 'Total')).toBe('40');
    expect(moduleValue('Controles', 'Inefetivos')).toBe('3');
    expect(moduleValue('Controles', 'Inativos')).toBe('8');

    expect(moduleValue('Compliance', 'Conforme')).toBe('62,5%');
    expect(moduleValue('Compliance', 'Requisitos')).toBe('25');
    expect(moduleValue('Compliance', 'Não atendidos')).toBe('4');

    expect(moduleValue('Auditoria', 'Abertas')).toBe('13');
    expect(moduleValue('Auditoria', 'Críticos')).toBe('0');

    expect(moduleValue('Indicadores', 'Monitorados')).toBe('11');
    expect(moduleValue('Indicadores', 'Fora do limiar')).toBe('2');

    expect(screen.getByText('Planos de ação por status')).toBeInTheDocument();
  });

  it('renders an all-zero scope as the ordinary case — no error, and muted attention cards', async () => {
    getDashboardMock.mockResolvedValueOnce(zeroDashboardFixture());
    getSummaryMock.mockResolvedValueOnce({
      metrics: [
        single('ACTION_OVERDUE_COUNT', 0),
        buckets('INCIDENT_OPEN_COUNT_BY_SEVERITY', { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }),
      ],
      breakdowns: {},
    });
    renderDashboard();
    await waitForLoaded();

    expect(statValue('Aprovações pendentes')).toBe('0');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    for (const heading of [
      'Aprovações pendentes',
      'Ações atrasadas',
      'Riscos para revisão',
      'Incidentes abertos',
    ]) {
      expect(cardFor(heading).getAttribute('data-attention')).toBe('idle');
    }
  });

  it('renders no card for a capability the summary omitted', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValueOnce({
      metrics: [single('CONTROL_INACTIVE_COUNT', 8)],
      breakdowns: { controls: { total: 40, active: 31, ineffective: 3 } },
    });
    renderDashboard();
    await waitForLoaded();

    expect(screen.getByRole('heading', { name: 'Controles' })).toBeInTheDocument();
    for (const absent of [
      'Incidentes',
      'Incidentes abertos',
      'Problemas',
      'Problemas pendentes',
      'Compliance',
      'Auditoria',
      'Indicadores',
      'Indicadores em alerta',
      'Planos de Ação',
      'Ações atrasadas',
      'Ações vencendo em breve',
    ]) {
      expect(screen.queryByRole('heading', { name: absent })).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Planos de ação por status')).not.toBeInTheDocument();
  });

  it('drops every breakdown-only figure when the breakdown blocks are absent', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValueOnce({ metrics: fullMetrics(), breakdowns: {} });
    renderDashboard();
    await waitForLoaded();

    for (const absent of [
      'Ações vencendo em breve',
      'Problemas pendentes',
      'Indicadores',
      'Indicadores em alerta',
    ]) {
      expect(screen.queryByRole('heading', { name: absent })).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Planos de ação por status')).not.toBeInTheDocument();
    expect(within(cardFor('Incidentes')).queryByText('Em andamento')).not.toBeInTheDocument();
    expect(within(cardFor('Problemas')).queryByText('Em análise')).not.toBeInTheDocument();
  });

  it('shows only the rows of a shared card that the caller may read', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValueOnce({
      metrics: [
        buckets('FINDING_OPEN_COUNT_BY_SEVERITY', { LOW: 2, MEDIUM: 0, HIGH: 0, CRITICAL: 1 }),
      ],
      breakdowns: {},
    });
    renderDashboard();
    await waitForLoaded();

    const audit = cardFor('Auditoria');
    expect(moduleValue('Auditoria', 'Achados')).toBe('3');
    expect(moduleValue('Auditoria', 'Críticos')).toBe('1');
    expect(within(audit).queryByText('Abertas')).not.toBeInTheDocument();
  });

  it('omits the approvals card — and only it — for a caller who can see risks but not decide approvals', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValueOnce({ metrics: [], breakdowns: {} });
    renderDashboard(['risk:view']);
    await waitForLoaded();

    expect(screen.queryByRole('heading', { name: 'Aprovações pendentes' })).not.toBeInTheDocument();
    expect(statValue('Riscos para revisão')).toBe('5');
    expect(moduleValue('Riscos', 'Total')).toBe('999');
  });

  it('explains itself instead of rendering a blank page when the caller can see nothing it summarizes', async () => {
    getDashboardMock.mockResolvedValueOnce(zeroDashboardFixture());
    getSummaryMock.mockResolvedValueOnce({ metrics: [], breakdowns: {} });
    renderDashboard([]);

    await waitFor(() =>
      expect(screen.getByText('Nada para mostrar aqui ainda')).toBeInTheDocument(),
    );
    expect(screen.queryByText('O que requer atenção agora')).not.toBeInTheDocument();
    expect(screen.queryByText('Visão dos módulos')).not.toBeInTheDocument();
    expect(screen.queryByText('Riscos por nível (residual)')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ações rápidas' })).not.toBeInTheDocument();
  });

  it('renders a metric with no data as an em dash, never as zero', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValueOnce({
      metrics: [
        {
          metricKey: 'COMPLIANCE_PERCENTAGE',
          shape: 'SINGLE_VALUE',
          scopeApplicability: 'ORGANIZATION_WIDE',
        },
      ],
      breakdowns: {},
    });
    renderDashboard();
    await waitForLoaded();

    expect(moduleValue('Compliance', 'Conforme')).toBe('—');
  });

  it('keeps the risk view and says the rest may be incomplete when only the summary fails', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockRejectedValueOnce(new Error('summary down'));
    renderDashboard();
    await waitForLoaded();

    expect(
      screen.getByText(/Não foi possível carregar o resumo das demais áreas agora/),
    ).toBeInTheDocument();
    expect(moduleValue('Riscos', 'Total')).toBe('999');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not render the planned-modules section while the registry is empty, and does when it is not', async () => {
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValueOnce({ metrics: [], breakdowns: {} });
    const { unmount } = renderDashboard();
    await waitForLoaded();
    expect(screen.queryByText('Módulos planejados')).not.toBeInTheDocument();
    unmount();

    getDashboardMock.mockResolvedValueOnce(
      dashboardFixture({
        plannedAreas: [{ key: 'FUTURE', label: 'Módulo futuro', status: 'PLANNED' }],
      }),
    );
    getSummaryMock.mockResolvedValueOnce({ metrics: [], breakdowns: {} });
    renderDashboard();
    await waitForLoaded();
    expect(screen.getByText('Módulos planejados')).toBeInTheDocument();
    expect(screen.getByText('Módulo futuro')).toBeInTheDocument();
  });

  it('shows the loading state, then the error state on failure, and recovers on retry', async () => {
    getDashboardMock.mockRejectedValueOnce(new Error('network down'));
    getDashboardMock.mockResolvedValueOnce(dashboardFixture());
    getSummaryMock.mockResolvedValue({ metrics: [], breakdowns: {} });

    renderDashboard();

    expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitForLoaded();
    expect(moduleValue('Riscos', 'Total')).toBe('999');
    expect(getDashboardMock).toHaveBeenCalledTimes(2);
  });
});
