import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActionEditForm } from './action-edit-form';

import type { Action } from '../types';

/**
 * S-10 (CONSOLIDATED.md; A7-F10, A5-F02, A1-report.md's "74 entradas quase
 * idênticas" note) — regression coverage for `ActionEditForm`'s
 * "Responsável" field. Before this fix, `actionsApi.listUsers()` fetched a
 * single, fixed `pageSize=100` page and fed a plain `<Select>` — a user
 * outside that first page could never be chosen, with no search and no
 * indication anything was missing. `searchUsers(q)` now backs a `UserPicker`
 * (`SearchablePicker`-based) that searches the directory server-side.
 *
 * Reverting the fix (`ActionEditForm` back to `listUsers()` + `<Select>`)
 * makes this test fail: there is no `Buscar por nome ou e-mail…` search
 * input in the old markup at all, so the "far" user (returned only by a
 * search, never by the bounded first page) can never be found or selected.
 */

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

const FAR_USER = { id: 'user-999', fullName: 'Usuário Além da Página 1' };

beforeEach(() => {
  searchUsersMock.mockReset();
  updateActionMock.mockReset();
  // The bounded "browse" page — mirrors the exact defect: a user beyond it
  // (`FAR_USER`) is absent from the unsearched result, present only once
  // the caller actually searches for them.
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
