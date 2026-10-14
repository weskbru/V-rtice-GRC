import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActionEditForm } from './action-edit-form';

import type { Action } from '../types';

const { searchUsersMock, updateActionMock } = vi.hoisted(() => ({
  searchUsersMock: vi.fn(),
  updateActionMock: vi.fn(),
}));

vi.mock('../api', () => ({
  actionsApi: {
    searchUsers: searchUsersMock,
    updateAction: updateActionMock,
  },
}));

const baseAction: Action = {
  id: 'action-1',
  code: 'ACT-2026-0001',
  orgUnit: { id: 'org-1', name: 'Vértice GRC' },
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

const FAR_USER = { id: 'user-999', fullName: 'Usuário Além da Página 1' };

beforeEach(() => {
  searchUsersMock.mockReset();
  updateActionMock.mockReset();
  searchUsersMock.mockResolvedValue({
    data: [{ id: 'user-1', fullName: 'Ana Souza' }],
    isPartial: true,
  });
});

describe('ActionEditForm — responsible picker (S-10)', () => {
  it('shows the current responsible immediately from the loaded action, with no fetch needed', () => {
    render(<ActionEditForm action={baseAction} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Responsável' })).toHaveTextContent('Ana Souza');
  });

  it('finds and selects a user OUTSIDE the directory’s first page via search, and saves it', async () => {
    searchUsersMock.mockImplementation((q: string) =>
      Promise.resolve(
        q === 'Além'
          ? { data: [FAR_USER], isPartial: false }
          : { data: [{ id: 'user-1', fullName: 'Ana Souza' }], isPartial: true },
      ),
    );
    updateActionMock.mockResolvedValue({ ...baseAction, responsible: FAR_USER });

    render(<ActionEditForm action={baseAction} onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Responsável' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome ou e-mail…'), {
      target: { value: 'Além' },
    });
    fireEvent.click(await screen.findByRole('option', { name: FAR_USER.fullName }));

    expect(screen.getByRole('combobox', { name: 'Responsável' })).toHaveTextContent(
      FAR_USER.fullName,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(updateActionMock).toHaveBeenCalledWith('action-1', {
        responsibleUserId: FAR_USER.id,
      }),
    );
  });
});
