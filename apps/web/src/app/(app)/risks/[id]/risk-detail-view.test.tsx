import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { RiskDetailView } from './risk-detail-view';

import type { RiskDetail, RiskLifecycleState } from '@/features/risks/types';

const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  },
}));
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/risks/risk-1',
  useSearchParams: () => currentSearch,
}));

const originalReplaceState = window.history.replaceState.bind(window.history);
let replaceStateMock: ReturnType<typeof vi.fn<typeof window.history.replaceState>>;

const {
  getRiskMock,
  getLifecycleMock,
  getActiveMethodologyMock,
  listAssessmentsMock,
  listTreatmentActionsMock,
  listUsersMock,
  listCategoriesMock,
  listTypesMock,
  listOriginsMock,
  listOrgUnitsMock,
  searchUsersMock,
  listHistoryMock,
  listAuditEventsMock,
} = vi.hoisted(() => ({
  getRiskMock: vi.fn(),
  getLifecycleMock: vi.fn(),
  getActiveMethodologyMock: vi.fn(),
  listAssessmentsMock: vi.fn(),
  listTreatmentActionsMock: vi.fn(),
  listUsersMock: vi.fn(),
  listCategoriesMock: vi.fn(),
  listTypesMock: vi.fn(),
  listOriginsMock: vi.fn(),
  listOrgUnitsMock: vi.fn(),
  searchUsersMock: vi.fn(),
  listHistoryMock: vi.fn(),
  listAuditEventsMock: vi.fn(),
}));

vi.mock('@/features/risks/api', () => ({
  risksApi: {
    getRisk: getRiskMock,
    getLifecycle: getLifecycleMock,
    getActiveMethodology: getActiveMethodologyMock,
    listAssessments: listAssessmentsMock,
    listTreatmentActions: listTreatmentActionsMock,
    listUsers: listUsersMock,
    listCategories: listCategoriesMock,
    listTypes: listTypesMock,
    listOrigins: listOriginsMock,
    listOrgUnits: listOrgUnitsMock,
    searchUsers: searchUsersMock,
    listHistory: listHistoryMock,
    listAuditEvents: listAuditEventsMock,
  },
}));

const baseRisk: RiskDetail = {
  id: 'risk-1',
  code: 'RSK-2026-0001',
  title: 'Falha no fornecedor crítico',
  descriptionExcerpt: 'Descrição completa do risco.',
  description: 'Descrição completa do risco.',
  status: 'IDENTIFIED',
  type: null,
  origin: null,
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  overdueReview: false,
  overdueTreatment: false,
  pendingApproval: false,
  version: 2,
  updatedAt: '2026-01-01T00:00:00.000Z',
  causes: [],
  consequences: [],
  currentAssessment: null,
  currentTreatment: null,
  controls: [],
  processes: [],
  assets: [],
  treatmentActionSummary: { total: 0, open: 0, overdue: 0 },
  identifiedOn: '2026-01-01',
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const baseLifecycle: RiskLifecycleState = {
  status: 'IDENTIFIED',
  pendingApproval: null,
  availableTransitions: [],
  traversedStatuses: ['DRAFT', 'IDENTIFIED'],
};

function renderView(permissions: readonly string[]): void {
  render(
    <AuthProvider initialSession={buildTestSession({ permissions })}>
      <RiskDetailView riskId="risk-1" />
    </AuthProvider>,
  );
}

function selectTab(name: string): void {
  const tab = screen.getByRole('tab', { name });
  act(() => {
    tab.focus();
  });
  fireEvent.click(tab);
}

describe('RiskDetailView', () => {
  beforeEach(() => {
    currentSearch = new URLSearchParams();
    replaceStateMock = vi.fn<typeof window.history.replaceState>();
    window.history.replaceState = replaceStateMock;
    getRiskMock.mockReset();
    getLifecycleMock.mockReset();
    getActiveMethodologyMock.mockReset();
    listAssessmentsMock.mockReset();
    listTreatmentActionsMock.mockReset();
    listUsersMock.mockReset();
    listCategoriesMock.mockReset();
    listTypesMock.mockReset();
    listOriginsMock.mockReset();
    listOrgUnitsMock.mockReset();
    searchUsersMock.mockReset();
    listHistoryMock.mockReset();
    listAuditEventsMock.mockReset();

    getLifecycleMock.mockResolvedValue(baseLifecycle);
    getActiveMethodologyMock.mockImplementation(() => new Promise(() => undefined));
    listAssessmentsMock.mockImplementation(() => new Promise(() => undefined));
    listTreatmentActionsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    listUsersMock.mockResolvedValue([]);
    listCategoriesMock.mockImplementation(() => new Promise(() => undefined));
    listTypesMock.mockImplementation(() => new Promise(() => undefined));
    listOriginsMock.mockImplementation(() => new Promise(() => undefined));
    listOrgUnitsMock.mockImplementation(() => new Promise(() => undefined));
    searchUsersMock.mockImplementation(() => new Promise(() => undefined));
    listHistoryMock.mockImplementation(() => new Promise(() => undefined));
    listAuditEventsMock.mockImplementation(() => new Promise(() => undefined));
  });

  afterEach(() => {
    window.history.replaceState = originalReplaceState;
  });

  it('fires exactly the two requests the page has always fired on mount — GET risk and GET lifecycle, nothing more (§4.9)', async () => {
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);

    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    await waitFor(() => expect(getLifecycleMock).toHaveBeenCalledTimes(1));
    expect(getRiskMock).toHaveBeenCalledTimes(1);
  });

  it('renders the breadcrumb, code, title and the five top-level groups', async () => {
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);

    expect(
      await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Riscos' })).toHaveAttribute('href', '/risks');
    expect(screen.getAllByText('RSK-2026-0001').length).toBeGreaterThan(0);

    for (const label of ['Visão geral', 'Análise', 'Resposta', 'Relacionamentos', 'Registro']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('shows "Não avaliado" only in the executive summary row — the level cards moved off Visão geral', async () => {
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);
    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });

    expect(screen.getAllByText('Não avaliado')).toHaveLength(2);
    expect(screen.getByText('Detalhes do risco')).toBeInTheDocument();
  });

  it('clicking a top-level group commits ?section= to its first visible leaf (URL-driven navigation, §4.4)', async () => {
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);
    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });

    selectTab('Análise');
    expect(screen.getByRole('tab', { name: 'Avaliação', selected: true })).toBeInTheDocument();
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '/risks/risk-1?section=assessment');
  });

  it('deep-links to "Análise" showing BOTH its leaves, with the real Causas e Consequências content active', async () => {
    currentSearch = new URLSearchParams('section=causes-consequences');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);

    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    expect(screen.getByRole('tab', { name: 'Avaliação' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Causas e Consequências' })).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma causa registrada ainda.')).toBeInTheDocument();
  });

  it('clicking a sibling leaf tab commits ?section= to that leaf', async () => {
    currentSearch = new URLSearchParams('section=causes-consequences');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);
    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });

    selectTab('Avaliação');
    expect(screen.getByRole('tab', { name: 'Avaliação', selected: true })).toBeInTheDocument();
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '/risks/risk-1?section=assessment');
  });

  it('deep-links to "Resposta" › Controles showing all three Resposta leaves, Controles content WITHOUT Processos/Ativos (R-6)', async () => {
    currentSearch = new URLSearchParams('section=controls');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);

    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    expect(screen.getByRole('tab', { name: 'Tratamento' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Controles' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planos de Ação' })).toBeInTheDocument();

    expect(await screen.findByText('Nenhum controle vinculado a este risco.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum processo vinculado a este risco.')).not.toBeInTheDocument();
    expect(screen.queryByText('Nenhum ativo vinculado a este risco.')).not.toBeInTheDocument();
  });

  it('deep-links to "Resposta" › Planos de Ação showing the real content, never the old placeholder', async () => {
    currentSearch = new URLSearchParams('section=action-plans');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);

    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    expect(
      await screen.findByText('Nenhuma ação de tratamento registrada ainda.'),
    ).toBeInTheDocument();
  });

  it('deep-links to "Relacionamentos" › Processos e Ativos, both families and NO Controles (R-6), and omits Evidência/Achados without permission', async () => {
    currentSearch = new URLSearchParams('section=processes-assets');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);

    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    expect(screen.getByRole('tab', { name: 'Incidentes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Problemas' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Processos e Ativos' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Evidência' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Achados' })).not.toBeInTheDocument();

    expect(await screen.findByText('Nenhum processo vinculado a este risco.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum ativo vinculado a este risco.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum controle vinculado a este risco.')).not.toBeInTheDocument();
  });

  it('shows Evidência/Achados under Relacionamentos for a caller who holds the view permission', async () => {
    currentSearch = new URLSearchParams('section=processes-assets');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view', 'evidence:view', 'finding:view']);

    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    expect(screen.getByRole('tab', { name: 'Evidência' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Achados' })).toBeInTheDocument();
  });

  it('deep-links to "Registro" › Histórico and omits Auditoria entirely for a caller without audit:view (FR-030, FR-094)', async () => {
    currentSearch = new URLSearchParams('section=history');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);

    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    expect(screen.getByRole('tab', { name: 'Histórico' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Anexos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Comentários' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Auditoria' })).not.toBeInTheDocument();
  });

  it('deep-links straight to "Registro" › Auditoria for a caller who holds audit:view', async () => {
    currentSearch = new URLSearchParams('section=audit');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view', 'audit:view']);

    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    expect(screen.getByRole('tab', { name: 'Auditoria', selected: true })).toBeInTheDocument();
  });

  it('falls back to Visão geral, without error, for an unknown ?section= id', async () => {
    currentSearch = new URLSearchParams('section=does-not-exist');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);

    expect(
      await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Detalhes do risco')).toBeInTheDocument();
  });

  it('falls back to Visão geral for a ?section= naming a leaf the caller has no permission for (FR-030)', async () => {
    currentSearch = new URLSearchParams('section=audit');
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);

    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    expect(screen.getByText('Detalhes do risco')).toBeInTheDocument();
  });

  it('shows an honest not-found message on 404 — never distinguishing "does not exist" from "out of scope" (FR-030)', async () => {
    getRiskMock.mockRejectedValueOnce(new ApiError({ title: 'Não encontrado', status: 404 }));
    renderView(['risk:view']);

    await waitFor(() => expect(screen.getByText('Risco não encontrado')).toBeInTheDocument());
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('hides the Editar action for a caller without risk:edit (advisory gating, FR-042)', async () => {
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view']);
    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('opens the edit panel (Sheet + RiskForm) for a caller who holds risk:edit, page underneath unchanged (§4.8)', async () => {
    getRiskMock.mockResolvedValueOnce({ risk: baseRisk, etag: '"2"' });
    renderView(['risk:view', 'risk:edit']);
    await screen.findByRole('heading', { name: 'Falha no fornecedor crítico' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Editar risco').length).toBeGreaterThan(0);
  });
});
