import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { FindingCorrectiveActions } from './finding-corrective-actions';

import type { UserRef } from '../types';
import type { Action } from '@/features/actions/types';

const { listActionsMock, createActionMock, transitionActionMock } = vi.hoisted(() => ({
  listActionsMock: vi.fn(),
  createActionMock: vi.fn(),
  transitionActionMock: vi.fn(),
}));

vi.mock('@/features/actions/api', () => ({
  actionsApi: {
    listActions: listActionsMock,
    createAction: createActionMock,
    transitionAction: transitionActionMock,
  },
}));

const { searchUsersMock } = vi.hoisted(() => ({ searchUsersMock: vi.fn() }));

vi.mock('../api', () => ({
  findingsApi: { searchUsers: searchUsersMock },
}));

const responsible: UserRef = { id: 'user-1', fullName: 'Ana Souza' };

function actionFixture(overrides: Partial<Action> = {}): Action {
  return {
    id: 'action-1',
    code: 'ACT-2026-0001',
    orgUnit: { id: 'org-1', name: 'Unidade de teste' },
    originType: 'FINDING',
    originId: 'finding-1',
    originLabel: 'FND-2026-0001',
    title: 'Corrigir a não conformidade',
    description: null,
    responsible,
    dueOn: '2026-12-31',
    status: 'OPEN',
    overdue: false,
    completedAt: null,
    reopenedAt: null,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  };
}

function renderWithPermissions(
  permissions: readonly string[],
  onActionsChanged?: () => void,
): ReturnType<typeof render> {
  return render(
    <AuthProvider initialSession={buildTestSession({ permissions: [...permissions] })}>
      <FindingCorrectiveActions
        findingId="finding-1"
        regionLabel="Ações de remediação do achado"
        onActionsChanged={onActionsChanged}
      />
    </AuthProvider>,
  );
}

describe('FindingCorrectiveActions', () => {
  beforeEach(() => {
    listActionsMock.mockReset();
    createActionMock.mockReset();
    transitionActionMock.mockReset();
    searchUsersMock.mockReset();
    searchUsersMock.mockResolvedValue({ data: [responsible], isPartial: false });
  });

  it('shows the honest empty state when no corrective action has been created yet', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });

    renderWithPermissions([]);

    expect(
      await screen.findByText('Nenhuma ação de remediação registrada ainda.'),
    ).toBeInTheDocument();
    expect(listActionsMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      originType: 'FINDING',
      originId: 'finding-1',
    });
    expect(
      screen.queryByRole('button', { name: 'Adicionar ação de remediação' }),
    ).not.toBeInTheDocument();
  });

  it('shows a loading state before the first response resolves', () => {
    listActionsMock.mockReturnValue(new Promise(() => undefined));

    renderWithPermissions([]);

    expect(screen.getByText('Carregando ações de remediação…')).toBeInTheDocument();
  });

  it('shows an honest error state when the load fails', async () => {
    listActionsMock.mockRejectedValue(new Error('network error'));

    renderWithPermissions([]);

    expect(
      await screen.findByText('Não foi possível carregar as ações de remediação.'),
    ).toBeInTheDocument();
  });

  it('hides creation and the row-actions menu for a caller without the required permissions', async () => {
    listActionsMock.mockResolvedValue({
      items: [actionFixture()],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    renderWithPermissions(['finding:view']);

    await screen.findByText('Corrigir a não conformidade');
    expect(
      screen.queryByRole('button', { name: 'Adicionar ação de remediação' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ações' })).not.toBeInTheDocument();
  });

  it('requires BOTH finding:edit and action:create before offering creation', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });

    renderWithPermissions(['finding:edit']);
    await screen.findByText('Nenhuma ação de remediação registrada ainda.');
    expect(
      screen.queryByRole('button', { name: 'Adicionar ação de remediação' }),
    ).not.toBeInTheDocument();
  });

  it('creates a new corrective action with originType FINDING and this finding as origin', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    createActionMock.mockResolvedValue(actionFixture({ title: 'Nova ação de remediação' }));

    renderWithPermissions(['finding:edit', 'action:create']);

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar ação de remediação' }));
    fireEvent.change(screen.getByLabelText(/^Título/), {
      target: { value: 'Nova ação de remediação' },
    });
    fireEvent.click(screen.getByRole('combobox', { name: /^Responsável/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Souza' }));
    fireEvent.change(screen.getByLabelText(/^Prazo/), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ação' }));

    await waitFor(() => expect(createActionMock).toHaveBeenCalledTimes(1));
    expect(createActionMock).toHaveBeenCalledWith({
      originType: 'FINDING',
      originId: 'finding-1',
      title: 'Nova ação de remediação',
      description: undefined,
      responsibleUserId: 'user-1',
      dueOn: '2026-12-31',
    });
  });

  it('tells its host to re-read the finding after creating an action, so the open count cannot go stale', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    createActionMock.mockResolvedValue(actionFixture({ title: 'Nova ação de remediação' }));
    const onActionsChanged = vi.fn();

    renderWithPermissions(['finding:edit', 'action:create'], onActionsChanged);

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar ação de remediação' }));
    fireEvent.change(screen.getByLabelText(/^Título/), {
      target: { value: 'Nova ação de remediação' },
    });
    fireEvent.click(screen.getByRole('combobox', { name: /^Responsável/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Souza' }));
    fireEvent.change(screen.getByLabelText(/^Prazo/), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ação' }));

    await waitFor(() => expect(onActionsChanged).toHaveBeenCalledTimes(1));
  });

  it('tells its host to re-read the finding after a transition, which can also move the open count', async () => {
    listActionsMock.mockResolvedValue({
      items: [actionFixture({ status: 'OPEN' })],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    transitionActionMock.mockResolvedValue(actionFixture({ status: 'IN_PROGRESS' }));
    const onActionsChanged = vi.fn();

    renderWithPermissions(['action:edit'], onActionsChanged);

    await screen.findByText('Corrigir a não conformidade');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Iniciar' }));

    await waitFor(() => expect(onActionsChanged).toHaveBeenCalledTimes(1));
  });

  it('does not notify its host when the create fails', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    createActionMock.mockRejectedValue(new Error('boom'));
    const onActionsChanged = vi.fn();

    renderWithPermissions(['finding:edit', 'action:create'], onActionsChanged);

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar ação de remediação' }));
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Não vai passar' } });
    fireEvent.click(screen.getByRole('combobox', { name: /^Responsável/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Souza' }));
    fireEvent.change(screen.getByLabelText(/^Prazo/), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ação' }));

    await waitFor(() => expect(createActionMock).toHaveBeenCalledTimes(1));
    expect(onActionsChanged).not.toHaveBeenCalled();
  });

  it('refuses to submit the create form without a responsible person or due date', async () => {
    listActionsMock.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });

    renderWithPermissions(['finding:edit', 'action:create']);

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar ação de remediação' }));
    fireEvent.change(screen.getByLabelText(/^Título/), { target: { value: 'Título qualquer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ação' }));

    expect(await screen.findByText('Selecione o responsável pela ação.')).toBeInTheDocument();
    expect(screen.getByText('Informe o prazo da ação.')).toBeInTheDocument();
    expect(createActionMock).not.toHaveBeenCalled();
  });

  it('marks an overdue action distinctly, alongside its status', async () => {
    listActionsMock.mockResolvedValue({
      items: [actionFixture({ overdue: true })],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    renderWithPermissions([]);

    await screen.findByText('Corrigir a não conformidade');
    expect(screen.getByText('Atrasada')).toBeInTheDocument();
  });

  it('links the action code to its detail route, /actions/{id}', async () => {
    listActionsMock.mockResolvedValue({
      items: [actionFixture()],
      page: 1,
      pageSize: 20,
      total: 1,
    });

    renderWithPermissions([]);

    const link = await screen.findByRole('link', { name: 'ACT-2026-0001' });
    expect(link).toHaveAttribute('href', '/actions/action-1');
  });

  it('offers only the legal transitions for the action´s current status, and applies a non-reason one immediately', async () => {
    listActionsMock.mockResolvedValue({
      items: [actionFixture({ status: 'OPEN' })],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    transitionActionMock.mockResolvedValue(actionFixture({ status: 'IN_PROGRESS' }));

    renderWithPermissions(['action:edit']);

    await screen.findByText('Corrigir a não conformidade');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Iniciar' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Cancelar' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: 'Concluir' })).not.toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Iniciar' }));

    await waitFor(() =>
      expect(transitionActionMock).toHaveBeenCalledWith('action-1', { to: 'IN_PROGRESS' }),
    );
  });

  it('routes the COMPLETED -> OPEN transition through the reason dialog, never applying it directly', async () => {
    listActionsMock.mockResolvedValue({
      items: [actionFixture({ status: 'COMPLETED', completedAt: '2026-02-01T00:00:00.000Z' })],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    transitionActionMock.mockResolvedValue(actionFixture({ status: 'OPEN' }));

    renderWithPermissions(['action:edit']);

    await screen.findByText('Corrigir a não conformidade');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reabrir' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    expect(transitionActionMock).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/^Motivo da reabertura/), {
      target: { value: 'Correção incompleta, reabrindo para complementar.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(transitionActionMock).toHaveBeenCalledWith('action-1', {
        to: 'OPEN',
        reason: 'Correção incompleta, reabrindo para complementar.',
      }),
    );
  });
});
