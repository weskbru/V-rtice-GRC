import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { FindingsPanel } from './findings-panel';

import type { Finding } from '../types';

/**
 * Component-mount evidence for T076/T077/T078 (`FindingsPanel`,
 * 002-shared-grc-foundation + 005-audit-findings, US3). `../api` is mocked
 * at the network boundary, mirroring `evidence-panel.test.tsx`'s own
 * pattern. `getFindingMock`/`startRemediationMock` back
 * `FindingRemediationAction`; the four `list*Links`/`list*Options` mocks
 * back the two `FindingLinksSection` subsections every row now renders
 * unconditionally (T078) — every existing test below default-resolves them
 * to an empty list so the section's own "Nenhum vinculado" text is all that
 * appears, never a thrown error from an unmocked call.
 * `@/features/audit-engagements/api` is mocked too, for the origin-notice
 * lookup (T077, SC-001) — its `getEngagement` is only ever actually called
 * when a fixture's own `auditEngagementId` is non-null (the default fixture
 * below keeps it `null`), so most tests never touch it either.
 */

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

// `FindingCorrectiveActions` (audit-findings follow-up, 2026-09-12) — mounted
// only after a row's own "N ações em aberto" toggle is expanded, never on
// this panel's own mount. Mocked here purely to prove that non-vacuity: most
// tests below never touch it.
const { listActionsMock } = vi.hoisted(() => ({ listActionsMock: vi.fn() }));

vi.mock('@/features/actions/api', () => ({
  actionsApi: {
    listActions: listActionsMock,
    createAction: vi.fn(),
    transitionAction: vi.fn(),
  },
}));

// T077, FR-010 — `FindingCloseDialog` (rendered by this panel) now checks
// for an active evidence link before allowing a close attempt. Default to
// "an evidence link exists" so every pre-existing close/segregation test
// below keeps exercising exactly what it did before this rule existed; the
// "no evidence" and "evidence check failed" paths get their own dedicated
// coverage in `finding-close-dialog.test.tsx`.
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

/**
 * 2026-09-17, Área 5 — every row is now a collapsed `DisclosureGroup` by
 * default (status/severity/edit/close/reopen/archive/links all live in its
 * unmounted-while-closed content). Tests that need any of that reveal the
 * row first, exactly like a real reader would, via the toggle's own
 * accessible name (code + title, from `DisclosureGroup`'s `title`/`meta`).
 */
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
  // T078 — every row's `FindingLinksSection` always renders (regardless of
  // `canLinkFindings`); default both its lists to empty so its own "Nenhum
  // vinculado" text is all any pre-existing test below sees.
  listControlLinksMock.mockResolvedValue([]);
  listRiskLinksMock.mockResolvedValue([]);
  // T077, FR-010 — default to "an active evidence link exists" (see the
  // mock's own comment above).
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

    // `canCreate` mounts `FindingCreateDialog`, which reads `useAuth().user`
    // unconditionally (S-10, to seed its owner picker's initial label with
    // no extra request) — every other `canCreate` render below is `false`
    // for exactly this reason, except the one right after this comment.
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

  // 2026-09-17, Área 5 — collapsed shows only what identifies/prioritizes
  // (code, title, status, severity), never the rest of the row's content;
  // expanding it reveals everything that rendered unconditionally before
  // this change, byte for byte (no capability removed).
  it('collapses each finding to code/title/status/severity only, revealing everything else on demand', async () => {
    listByOrgUnitMock.mockResolvedValue(pageOf([findingFixture({})]));

    render(<FindingsPanel {...BASE_PROPS} canCreate={false} canEdit canClose canAdminister />);

    const toggle = await screen.findByRole('button', {
      name: /FND-2026-0001 — Segregação de funções não aplicada/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Aberto')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    // Everything else stays unmounted while collapsed.
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

  // -------------------------------------------------------------------
  // 005-audit-findings, T077 additions
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // Corrective actions disclosure (audit-findings follow-up, 2026-09-12)
  // -------------------------------------------------------------------

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
