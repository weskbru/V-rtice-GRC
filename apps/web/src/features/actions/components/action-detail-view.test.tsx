import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { ActionDetailView } from './action-detail-view';

import type { Action } from '../types';

/**
 * Component-mount evidence for the action detail screen this task adds —
 * `getAction`/`updateAction` had no caller anywhere in the frontend before
 * it. Mirrors `risk-detail-view.test.tsx`'s own conventions (mocked
 * feature API, `AuthProvider` + `buildTestSession` for permission gating).
 */

const {
  getActionMock,
  updateActionMock,
  transitionActionMock,
  listActionAuditEventsMock,
  searchUsersMock,
} = vi.hoisted(() => ({
  getActionMock: vi.fn(),
  updateActionMock: vi.fn(),
  transitionActionMock: vi.fn(),
  listActionAuditEventsMock: vi.fn(),
  searchUsersMock: vi.fn(),
}));

vi.mock('../api', () => ({
  actionsApi: {
    getAction: getActionMock,
    updateAction: updateActionMock,
    transitionAction: transitionActionMock,
    listActionAuditEvents: listActionAuditEventsMock,
    searchUsers: searchUsersMock,
  },
}));

const baseAction: Action = {
  id: 'action-1',
  code: 'ACT-2026-0001',
  orgUnit: { id: 'org-1', name: 'PharosGRC' },
  originType: 'RISK_TREATMENT',
  originId: 'risk-1',
  originLabel: 'RSK-2026-0001 — Falha no fornecedor crítico',
  title: 'Corrigir configuração de firewall',
  description: 'Aplicar a regra revisada no firewall perimetral.',
  responsible: { id: 'user-1', fullName: 'Ana Souza' },
  dueOn: '2026-05-01',
  status: 'OPEN',
  overdue: false,
  completedAt: null,
  reopenedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  getActionMock.mockReset();
  updateActionMock.mockReset();
  transitionActionMock.mockReset();
  listActionAuditEventsMock.mockReset();
  searchUsersMock.mockReset();
  searchUsersMock.mockResolvedValue({
    data: [{ id: 'user-1', fullName: 'Ana Souza' }],
    isPartial: false,
  });
  listActionAuditEventsMock.mockResolvedValue({
    data: [],
    meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
  });
});

function renderView(
  actionId: string,
  permissions: readonly string[] = ['action:view'],
): ReturnType<typeof render> {
  return render(
    <AuthProvider initialSession={buildTestSession({ permissions: [...permissions] })}>
      <ActionDetailView actionId={actionId} />
    </AuthProvider>,
  );
}

describe('ActionDetailView', () => {
  it('shows a loading state before the action resolves', () => {
    getActionMock.mockReturnValue(new Promise(() => undefined));
    renderView('action-1');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an honest not-found message on 404 — never distinguishing "does not exist" from "out of scope" (non-disclosure)', async () => {
    getActionMock.mockRejectedValueOnce(new ApiError({ title: 'Não encontrado', status: 404 }));
    renderView('action-missing');

    await waitFor(() => expect(screen.getByText('Ação não encontrada')).toBeInTheDocument());
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('shows a distinct message when the caller lacks action:view entirely (403)', async () => {
    getActionMock.mockRejectedValueOnce(new ApiError({ title: 'Proibido', status: 403 }));
    renderView('action-1');

    await waitFor(() =>
      expect(screen.getByText('Sem permissão para ver esta ação')).toBeInTheDocument(),
    );
  });

  it('shows the generic error state for any other failure', async () => {
    getActionMock.mockRejectedValueOnce(
      new ApiError({ title: 'Falha interna', detail: 'Tente novamente.', status: 500 }),
    );
    renderView('action-1');

    await waitFor(() => expect(screen.getByText('Falha interna')).toBeInTheDocument());
  });

  it('renders the action once loaded, including the overdue badge when overdue', async () => {
    getActionMock.mockResolvedValueOnce({ ...baseAction, overdue: true });
    renderView('action-1');

    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });
    expect(screen.getByText('Atrasada')).toBeInTheDocument();
  });

  it('omits the overdue badge when the action is not overdue', async () => {
    getActionMock.mockResolvedValueOnce({ ...baseAction, overdue: false });
    renderView('action-1');

    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });
    expect(screen.queryByText('Atrasada')).not.toBeInTheDocument();
  });

  it('hides the Editar action and the lifecycle bar for a caller with only action:view (FR-042)', async () => {
    getActionMock.mockResolvedValueOnce(baseAction);
    renderView('action-1', ['action:view']);

    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    // OPEN offers "Iniciar"/"Cancelar" when action:edit is present — absent here.
    expect(screen.queryByRole('button', { name: 'Iniciar' })).not.toBeInTheDocument();
  });

  it('shows the Editar action and the lifecycle bar for a caller who holds action:edit', async () => {
    getActionMock.mockResolvedValueOnce(baseAction);
    renderView('action-1', ['action:view', 'action:edit']);

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar' })).toBeInTheDocument();
  });

  it('offers no lifecycle transition for a CANCELLED (terminal) action, even with action:edit', async () => {
    getActionMock.mockResolvedValueOnce({ ...baseAction, status: 'CANCELLED' });
    renderView('action-1', ['action:view', 'action:edit']);

    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });
    expect(screen.queryByRole('button', { name: 'Iniciar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument();
  });

  it('shows the origin as a link for RISK_TREATMENT (a real detail route)', async () => {
    getActionMock.mockResolvedValueOnce(baseAction);
    renderView('action-1');

    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });
    const link = screen.getByRole('link', { name: baseAction.originLabel });
    expect(link).toHaveAttribute('href', '/risks/risk-1');
  });

  it('shows the origin as plain text (never a broken link) for FINDING/CONTROL_ASSESSMENT', async () => {
    getActionMock.mockResolvedValueOnce({
      ...baseAction,
      originType: 'CONTROL_ASSESSMENT',
      originId: 'assessment-1',
      originLabel: undefined,
    });
    renderView('action-1');

    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });
    expect(screen.queryByRole('link', { name: 'Verificação de controle' })).not.toBeInTheDocument();
    expect(screen.getByText('Verificação de controle')).toBeInTheDocument();
  });

  it('hides the Auditoria tab for a caller without audit:view (FR-030)', async () => {
    getActionMock.mockResolvedValueOnce(baseAction);
    renderView('action-1', ['action:view']);

    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });
    expect(screen.queryByRole('tab', { name: 'Auditoria' })).not.toBeInTheDocument();
  });

  it('shows the Auditoria tab for a caller with audit:view (content behavior covered by action-audit-section.test.tsx)', async () => {
    getActionMock.mockResolvedValueOnce(baseAction);
    renderView('action-1', ['action:view', 'audit:view']);

    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });
    expect(screen.getByRole('tab', { name: 'Auditoria' })).toBeInTheDocument();
  });

  it('sends only the fields the user actually changed on save', async () => {
    getActionMock.mockResolvedValueOnce(baseAction);
    updateActionMock.mockResolvedValueOnce({ ...baseAction, title: 'Novo título' });
    renderView('action-1', ['action:view', 'action:edit']);

    const editButton = await screen.findByRole('button', { name: 'Editar' });
    fireEvent.click(editButton);

    const titleInput = await screen.findByLabelText(/^Título/);
    fireEvent.change(titleInput, { target: { value: 'Novo título' } });

    const saveButton = screen.getByRole('button', { name: 'Salvar alterações' });
    fireEvent.click(saveButton);

    await waitFor(() => expect(updateActionMock).toHaveBeenCalledTimes(1));
    expect(updateActionMock).toHaveBeenCalledWith('action-1', { title: 'Novo título' });
  });

  it('opens ActionEditPanel (Sheet + ActionEditForm) for a caller who holds action:edit — the page underneath stays readable', async () => {
    getActionMock.mockResolvedValueOnce(baseAction);
    renderView('action-1', ['action:view', 'action:edit']);
    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    // Radix marks the rest of the page `aria-hidden` while the modal Sheet
    // is open (mirrors `incident-detail-view.test.tsx`'s own identical
    // note) — this only asserts the panel itself opened, not that the
    // read-only page underneath remains in the accessibility tree while it
    // is open.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Editar ação').length).toBeGreaterThan(0);
  });

  it('never swaps "Visão geral" for the form inline any more — Ciclo de vida stays on screen after clicking Editar', async () => {
    getActionMock.mockResolvedValueOnce(baseAction);
    renderView('action-1', ['action:view', 'action:edit']);
    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await screen.findByRole('dialog');

    // "Ciclo de vida" is part of the SAME "Visão geral" section that used
    // to be swapped out for the form — its continued presence in the DOM
    // proves the overlay opened alongside the read-only page, not instead
    // of it.
    expect(screen.getAllByText('Ciclo de vida').length).toBeGreaterThan(0);
  });

  it('shows no separate "Fechar" icon button — ActionEditForm\'s own "Cancelar" is the one visible close affordance, and it actually closes the panel', async () => {
    getActionMock.mockResolvedValueOnce(baseAction);
    renderView('action-1', ['action:view', 'action:edit']);
    await screen.findByRole('heading', { name: 'Corrigir configuração de firewall' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await screen.findByRole('dialog');

    // `showCloseButton={false}` on `SheetContent` — see `action-edit-panel
    // .tsx`'s own header comment for why: `ActionEditForm` already renders
    // its own "Cancelar", and a second, icon-only "Fechar" control would be
    // a duplicate affordance.
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
    fireEvent.click(cancelButton);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The inline "Visão geral" content (never replaced, Fase C) is still
    // there, unaffected by the cancel.
    expect(screen.getByText('Ciclo de vida')).toBeInTheDocument();
  });
});
