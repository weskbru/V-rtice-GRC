import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { EngagementFindingsSection } from './engagement-findings-section';

const { listEngagementFindingsMock } = vi.hoisted(() => ({
  listEngagementFindingsMock: vi.fn(),
}));

vi.mock('../api', () => ({
  auditEngagementsApi: { listEngagementFindings: listEngagementFindingsMock },
}));

vi.mock('@/features/findings/api', () => ({
  findingsApi: { searchUsers: vi.fn().mockResolvedValue({ data: [], isPartial: false }) },
}));

function findingSummaryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'finding-1',
    code: 'FND-2026-0001',
    title: 'Controle de acesso não revisado',
    category: 'CONTROL_DEFICIENCY',
    origin: 'CONTROL_TESTING',
    severity: 'HIGH',
    priority: 'HIGH',
    owner: { id: 'user-1', fullName: 'Ana Souza' },
    status: 'OPEN',
    auditEngagementId: 'audit-1',
    identifiedOn: '2026-03-01',
    createdAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  };
}

function pageOf(items: unknown[]) {
  return { data: items, meta: { page: 1, pageSize: 100, total: items.length, totalPages: 1 } };
}

beforeEach(() => {
  listEngagementFindingsMock.mockReset();
});

const BASE_PROPS = {
  engagementId: 'audit-1',
  canCreate: false,
  defaultOwnerUserId: 'user-1',
};

function renderSection(
  props: Partial<React.ComponentProps<typeof EngagementFindingsSection>> = {},
): ReturnType<typeof render> {
  return render(
    <AuthProvider initialSession={buildTestSession()}>
      <EngagementFindingsSection {...BASE_PROPS} engagementStatus="IN_PROGRESS" {...props} />
    </AuthProvider>,
  );
}

describe('EngagementFindingsSection', () => {
  it('lists the findings this engagement produced', async () => {
    listEngagementFindingsMock.mockResolvedValue(pageOf([findingSummaryFixture()]));

    renderSection();

    await screen.findByText('FND-2026-0001');
    expect(listEngagementFindingsMock).toHaveBeenCalledWith('audit-1', {
      page: 1,
      pageSize: 100,
    });
  });

  it('shows a genuine empty state when no findings exist yet', async () => {
    listEngagementFindingsMock.mockResolvedValue(pageOf([]));

    renderSection();

    await screen.findByText('Nenhum achado registrado a partir deste engajamento ainda.');
  });

  it('shows the load error with a retry action, and recovers on retry', async () => {
    listEngagementFindingsMock.mockRejectedValueOnce(new Error('network error'));
    listEngagementFindingsMock.mockResolvedValueOnce(pageOf([findingSummaryFixture()]));

    renderSection();

    await screen.findByText('Não foi possível carregar os achados deste engajamento.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await screen.findByText('FND-2026-0001');
  });

  it('states the IN_PROGRESS precondition proactively, and disables the action, for a PLANNING engagement', async () => {
    listEngagementFindingsMock.mockResolvedValue(pageOf([]));

    renderSection({ canCreate: true, engagementStatus: 'PLANNING' });

    await screen.findByText(
      'Só é possível registrar achados enquanto o engajamento está em execução.',
    );
    expect(screen.getByRole('button', { name: 'Registrar achado' })).toBeDisabled();
  });

  it('enables the action for an IN_PROGRESS engagement, with no precondition notice', async () => {
    listEngagementFindingsMock.mockResolvedValue(pageOf([]));

    renderSection({ canCreate: true });

    await waitFor(() => expect(listEngagementFindingsMock).toHaveBeenCalled());
    expect(
      screen.queryByText(
        'Só é possível registrar achados enquanto o engajamento está em execução.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar achado' })).not.toBeDisabled();
  });
});
