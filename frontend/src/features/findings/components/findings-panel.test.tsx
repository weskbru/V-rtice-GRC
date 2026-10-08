import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { FindingsPanel } from './findings-panel';

import type { Finding } from '../types';

const {
  listByOrgUnitMock,
  getFindingMock,
  createFindingMock,
  updateFindingMock,
  closeFindingMock,
  reopenFindingMock,
  archiveFindingMock,
  searchUsersMock,
  startRemediationMock,
  listControlLinksMock,
  listRiskLinksMock,
  listControlOptionsMock,
  listRiskOptionsMock,
  linkControlMock,
  unlinkControlMock,
  linkRiskMock,
  unlinkRiskMock,
} = vi.hoisted(() => ({
  listByOrgUnitMock: vi.fn(),
  getFindingMock: vi.fn(),
  createFindingMock: vi.fn(),
  updateFindingMock: vi.fn(),
  closeFindingMock: vi.fn(),
  reopenFindingMock: vi.fn(),
  archiveFindingMock: vi.fn(),
  searchUsersMock: vi.fn(),
  startRemediationMock: vi.fn(),
  listControlLinksMock: vi.fn(),
  listRiskLinksMock: vi.fn(),
  listControlOptionsMock: vi.fn(),
  listRiskOptionsMock: vi.fn(),
  linkControlMock: vi.fn(),
  unlinkControlMock: vi.fn(),
  linkRiskMock: vi.fn(),
  unlinkRiskMock: vi.fn(),
}));

const { getEngagementMock } = vi.hoisted(() => ({ getEngagementMock: vi.fn() }));

const { listActionsMock } = vi.hoisted(() => ({ listActionsMock: vi.fn() }));

vi.mock('@/features/actions/api', () => ({
  actionsApi: {
    listActions: listActionsMock,
    createAction: vi.fn(),
    transitionAction: vi.fn(),
  },
}));

const { listBySubjectMock } = vi.hoisted(() => ({ listBySubjectMock: vi.fn() }));

vi.mock('@/features/evidence/api', () => ({
  evidenceApi: { listBySubject: listBySubjectMock },
}));

vi.mock('../api', () => ({
  findingsApi: {
    listByOrgUnit: listByOrgUnitMock,
    getFinding: getFindingMock,
    createFinding: createFindingMock,
    updateFinding: updateFindingMock,
    closeFinding: closeFindingMock,
    reopenFinding: reopenFindingMock,
    archiveFinding: archiveFindingMock,
    searchUsers: searchUsersMock,
    startRemediation: startRemediationMock,
    listControlLinks: listControlLinksMock,
    listRiskLinks: listRiskLinksMock,
    listControlOptions: listControlOptionsMock,
    listRiskOptions: listRiskOptionsMock,
    linkControl: linkControlMock,
    unlinkControl: unlinkControlMock,
    linkRisk: linkRiskMock,
    unlinkRisk: unlinkRiskMock,
  },
}));

vi.mock('@/features/audit-engagements/api', () => ({
  auditEngagementsApi: {
    getEngagement: getEngagementMock,
  },
}));

function findingFixture(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'finding-1',
    code: 'FND-2026-0001',
    orgUnit: { id: 'org-1', name: 'Unidade de teste' },
    title: 'Segregação de funções não aplicada',
    description: 'A autoavaliação identificou uma não conformidade.',
    recommendation: null,
    category: 'NONCONFORMITY',
    origin: 'INTERNAL_ASSESSMENT',
    severity: 'HIGH',
    priority: 'HIGH',
    owner: { id: 'user-1', fullName: 'Ana Souza' },
    identifiedOn: '2026-02-01',
    status: 'OPEN',
    openActionCount: 0,
    evidenceCount: 0,
    closedAt: null,
    closureJustification: null,
    auditEngagementId: null,
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

function pageOf(items: Finding[]) {
  return { items, page: 1, pageSize: 100, total: items.length };
}

async function expandFinding(codeAndTitle: string | RegExp): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: codeAndTitle }));
}

beforeEach(() => {
  listByOrgUnitMock.mockReset();
  getFindingMock.mockReset();
  createFindingMock.mockReset();
  updateFindingMock.mockReset();
  closeFindingMock.mockReset();
  reopenFindingMock.mockReset();
  archiveFindingMock.mockReset();
  searchUsersMock.mockReset();
  startRemediationMock.mockReset();
  listControlLinksMock.mockReset();
  listRiskLinksMock.mockReset();
  listControlOptionsMock.mockReset();
  listRiskOptionsMock.mockReset();
  linkControlMock.mockReset();
  unlinkControlMock.mockReset();
  linkRiskMock.mockReset();
  unlinkRiskMock.mockReset();
  getEngagementMock.mockReset();
  listBySubjectMock.mockReset();
  listActionsMock.mockReset();
  listByOrgUnitMock.mockResolvedValue(pageOf([]));
  searchUsersMock.mockResolvedValue({ data: [], isPartial: false });
  listControlLinksMock.mockResolvedValue([]);
  listRiskLinksMock.mockResolvedValue([]);
  listBySubjectMock.mockResolvedValue({
    items: [{ id: 'evidence-1' }],
    page: 1,
    pageSize: 100,
    total: 1,
  });
});

const BASE_PROPS = {
  orgUnitId: 'org-1',
  defaultOwnerUserId: 'user-1',
  canRemediate: false,
  canLinkFindings: false,
};

describe('FindingsPanel', () => {
  it('lists findings within the organizational unit, with their metadata', async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({})]));

    render(
      <AuthProvider initialSession={buildTestSession({ permissions: [] })}>
        <FindingsPanel {...BASE_PROPS} canCreate canEdit canClose canAdminister />
      </AuthProvider>,
    );

    await screen.findByText('FND-2026-0001 — Segregação de funções não aplicada');
    expect(listByOrgUnitMock).toHaveBeenCalledWith('org-1');
    expect(screen.getByText('Aberto')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('collapses each finding to code/title/status/severity only, revealing everything else on demand', async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({})]));

    render(<FindingsPanel {...BASE_PROPS} canCreate={false} canEdit canClose canAdminister />);

    const toggle = await screen.findByRole('button', {
      name: /FND-2026-0001 — Segregação de funções não aplicada/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Aberto')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(
      screen.queryByText('A autoavaliação identificou uma não conformidade.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      await screen.findByText('A autoavaliação identificou uma não conformidade.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(
      screen.getByText('Este achado foi registrado manualmente, sem vínculo a um engajamento.'),
    ).toBeInTheDocument();
  });

  it('renders an empty state when no findings are registered yet', async () => {
    render(
      <FindingsPanel
        {...BASE_PROPS}
        canCreate={false}
        canEdit={false}
        canClose={false}
        canAdminister={false}
      />,
    );
    await waitFor(() => expect(listByOrgUnitMock).toHaveBeenCalled());
    expect(screen.getByText('Nenhum achado registrado ainda.')).toBeInTheDocument();
  });

  it('hides the "Novo achado" action for a caller without finding:create', async () => {
    render(<FindingsPanel {...BASE_PROPS} canCreate={false} canEdit canClose canAdminister />);
    await waitFor(() => expect(listByOrgUnitMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Novo achado' })).not.toBeInTheDocument();
  });

  it('shows the "Novo achado" action for a caller holding finding:create', async () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: [] })}>
        <FindingsPanel
          {...BASE_PROPS}
          canCreate
          canEdit={false}
          canClose={false}
          canAdminister={false}
        />
      </AuthProvider>,
    );
    await waitFor(() => expect(listByOrgUnitMock).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Novo achado' })).toBeInTheDocument();
  });

  it('offers "Encerrar" for an OPEN finding and "Reabrir" for a CLOSED one, never both at once', async () => {
    listByOrgUnitMock.mockResolvedValue(
      pageOf([
        findingFixture({ id: 'finding-open', status: 'OPEN' }),
        findingFixture({ id: 'finding-closed', status: 'CLOSED', code: 'FND-2026-0002' }),
      ]),
    );

    render(
      <FindingsPanel
        {...BASE_PROPS}
        canCreate={false}
        canEdit={false}
        canClose
        canAdminister={false}
      />,
    );

    await screen.findByText('FND-2026-0001 — Segregação de funções não aplicada');
    await expandFinding(/FND-2026-0001/);
    await expandFinding(/FND-2026-0002/);
    expect(screen.getAllByRole('button', { name: 'Encerrar' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Reabrir' })).toHaveLength(1);
  });

  it('only offers "Arquivar" for a CLOSED finding, never an OPEN one (Invariant F4)', async () => {
    listByOrgUnitMock.mockResolvedValue(
      pageOf([
        findingFixture({ id: 'finding-open', status: 'OPEN' }),
        findingFixture({ id: 'finding-closed', status: 'CLOSED', code: 'FND-2026-0002' }),
      ]),
    );

    render(
      <FindingsPanel
        {...BASE_PROPS}
        canCreate={false}
        canEdit={false}
        canClose={false}
        canAdminister
      />,
    );

    await screen.findByText('FND-2026-0001 — Segregação de funções não aplicada');
    await expandFinding(/FND-2026-0001/);
    await expandFinding(/FND-2026-0002/);
    expect(screen.getAllByRole('button', { name: 'Arquivar' })).toHaveLength(1);
  });

  it('closes a finding after confirming, and reflects the CLOSED status without a refetch', async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({})]));
    closeFindingMock.mockResolvedValue(
      findingFixture({ status: 'CLOSED', closedAt: '2026-03-01T00:00:00.000Z' }),
    );

    render(
      <FindingsPanel
        {...BASE_PROPS}
        canCreate={false}
        canEdit={false}
        canClose
        canAdminister={false}
      />,
    );

    await expandFinding(/FND-2026-0001/);
    const closeButton = await screen.findByRole('button', { name: 'Encerrar' });
    fireEvent.click(closeButton);

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Encerrar' });
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(closeFindingMock).toHaveBeenCalledWith('finding-1', { justification: undefined }),
    );
    await screen.findByText('Encerrado');
  });

  it('surfaces the segregation-of-duties refusal distinctly on a 403', async () => {
    const { ApiError } = await import('@/lib/api-client');
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({})]));
    closeFindingMock.mockRejectedValue(
      new ApiError({ status: 403, title: 'Proibido', type: 'about:blank' }),
    );

    render(
      <FindingsPanel
        {...BASE_PROPS}
        canCreate={false}
        canEdit={false}
        canClose
        canAdminister={false}
      />,
    );

    await expandFinding(/FND-2026-0001/);
    const closeButton = await screen.findByRole('button', { name: 'Encerrar' });
    fireEvent.click(closeButton);

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Encerrar' });
    fireEvent.click(confirmButton);

    await screen.findByText(
      'Quem executou a remediação não pode encerrar o achado. Peça que outra pessoa com permissão de encerramento realize esta ação.',
    );
  });

  it('archives a CLOSED finding after confirming', async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({ status: 'CLOSED' })]));
    archiveFindingMock.mockResolvedValue(findingFixture({ status: 'ARCHIVED' }));

    render(
      <FindingsPanel
        {...BASE_PROPS}
        canCreate={false}
        canEdit={false}
        canClose={false}
        canAdminister
      />,
    );

    await expandFinding(/FND-2026-0001/);
    const archiveButton = await screen.findByRole('button', { name: 'Arquivar' });
    fireEvent.click(archiveButton);

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Arquivar' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(archiveFindingMock).toHaveBeenCalledWith('finding-1'));
    await screen.findByText('Arquivado');
  });

  it('shows the manual-origin notice for a finding recorded without an engagement', async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({ auditEngagementId: null })]));

    render(
      <FindingsPanel
        {...BASE_PROPS}
        canCreate={false}
        canEdit={false}
        canClose={false}
        canAdminister={false}
      />,
    );

    await expandFinding(/FND-2026-0001/);
    await screen.findByText(
      'Este achado foi registrado manualmente, sem vínculo a um engajamento.',
    );
    expect(getEngagementMock).not.toHaveBeenCalled();
  });

  it("resolves and shows the producing engagement's own code for a finding it produced (SC-001)", async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({ auditEngagementId: 'audit-1' })]));
    getEngagementMock.mockResolvedValue({
      engagement: { code: 'AUD-2026-0001' },
      etag: '"1"',
    });

    render(
      <FindingsPanel
        {...BASE_PROPS}
        canCreate={false}
        canEdit={false}
        canClose={false}
        canAdminister={false}
      />,
    );

    await waitFor(() => expect(getEngagementMock).toHaveBeenCalledWith('audit-1'));
    await expandFinding(/FND-2026-0001/);
    await screen.findByText(
      'Este achado foi produzido pelo engajamento de auditoria AUD-2026-0001.',
    );
  });

  it('offers "Mover para remediação" for an OPEN finding when canRemediate, and refetches after confirming', async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({ status: 'OPEN' })]));
    startRemediationMock.mockResolvedValue({ id: 'finding-1', status: 'IN_REMEDIATION' });
    getFindingMock.mockResolvedValue(findingFixture({ status: 'IN_REMEDIATION' }));

    render(
      <FindingsPanel
        {...BASE_PROPS}
        canRemediate
        canCreate={false}
        canEdit={false}
        canClose={false}
        canAdminister={false}
      />,
    );

    await expandFinding(/FND-2026-0001/);
    const action = await screen.findByRole('button', { name: 'Mover para remediação' });
    fireEvent.click(action);

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Confirmar' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(startRemediationMock).toHaveBeenCalledWith('finding-1'));
    await waitFor(() => expect(getFindingMock).toHaveBeenCalledWith('finding-1'));
    await screen.findByText('Em remediação');
  });

  it('never offers "Mover para remediação" without finding:remediate', async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({ status: 'OPEN' })]));

    render(
      <FindingsPanel
        {...BASE_PROPS}
        canCreate={false}
        canEdit={false}
        canClose={false}
        canAdminister={false}
      />,
    );

    await expandFinding(/FND-2026-0001/);
    expect(screen.queryByRole('button', { name: 'Mover para remediação' })).not.toBeInTheDocument();
  });

  it('never fetches corrective actions on mount, regardless of how many findings render', async () => {
    listByOrgUnitMock.mockResolvedValue(
      pageOf([
        findingFixture({ id: 'finding-1', openActionCount: 2 }),
        findingFixture({ id: 'finding-2', code: 'FND-2026-0002', openActionCount: 0 }),
      ]),
    );

    render(
      <AuthProvider initialSession={buildTestSession({ permissions: [] })}>
        <FindingsPanel
          {...BASE_PROPS}
          canCreate={false}
          canEdit={false}
          canClose={false}
          canAdminister={false}
        />
      </AuthProvider>,
    );

    await screen.findByText('FND-2026-0001 — Segregação de funções não aplicada');
    await screen.findByText('FND-2026-0002 — Segregação de funções não aplicada');
    expect(listActionsMock).not.toHaveBeenCalled();
  });

  it('expands a finding´s own corrective-actions section on demand, fetching only that finding´s actions', async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({ openActionCount: 1 })]));
    listActionsMock.mockResolvedValue({
      items: [
        {
          id: 'action-1',
          code: 'ACT-2026-0001',
          orgUnit: { id: 'org-1', name: 'Unidade de teste' },
          originType: 'FINDING',
          originId: 'finding-1',
          originLabel: 'FND-2026-0001',
          title: 'Corrigir a não conformidade',
          description: null,
          responsible: { id: 'user-1', fullName: 'Ana Souza' },
          dueOn: '2026-12-31',
          status: 'OPEN',
          overdue: false,
          completedAt: null,
          reopenedAt: null,
          createdAt: '2026-01-10T00:00:00.000Z',
          updatedAt: '2026-01-10T00:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    render(
      <AuthProvider initialSession={buildTestSession({ permissions: [] })}>
        <FindingsPanel
          {...BASE_PROPS}
          canCreate={false}
          canEdit={false}
          canClose={false}
          canAdminister={false}
        />
      </AuthProvider>,
    );

    await expandFinding(/FND-2026-0001/);
    const toggle = await screen.findByRole('button', { name: /1 ação em aberto/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await waitFor(() =>
      expect(listActionsMock).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        originType: 'FINDING',
        originId: 'finding-1',
      }),
    );
    const link = await screen.findByRole('link', { name: 'ACT-2026-0001' });
    expect(link).toHaveAttribute('href', '/actions/action-1');
  });
});
