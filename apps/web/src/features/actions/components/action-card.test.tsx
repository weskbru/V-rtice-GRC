import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActionCard } from './action-card';

import type { Action } from '../types';

/**
 * Component-mount evidence for `ActionCard` (CLAUDE.md §18.12) — the card
 * anatomy this register's family requires: código → título → badges →
 * three metadata fields (Origem, Responsável, Prazo) → "Atualizado em",
 * plus the row-actions menu the coordinator's instructions require stay
 * reachable in card view.
 */
const baseAction: Action = {
  id: 'action-1',
  code: 'ACT-2026-0001',
  orgUnit: { id: 'org-1', name: 'PharosGRC' },
  originType: 'RISK_TREATMENT',
  originId: 'risk-1',
  originLabel: 'RSK-2026-0001 — Falha no fornecedor crítico',
  title: 'Corrigir configuração de firewall',
  description: null,
  responsible: { id: 'user-1', fullName: 'Ana Souza' },
  dueOn: '2026-05-01',
  status: 'OPEN',
  overdue: false,
  completedAt: null,
  reopenedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
};

describe('ActionCard', () => {
  it('shows the code and title, each linking to /actions/{id}', () => {
    render(
      <ActionCard
        action={baseAction}
        canEdit={false}
        onTransition={vi.fn()}
        onReopenRequest={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: baseAction.code })).toHaveAttribute(
      'href',
      '/actions/action-1',
    );
    expect(
      screen.getByRole('link', {
        name: /Corrigir configuração de firewall/,
      }),
    ).toHaveAttribute('href', '/actions/action-1');
  });

  it('shows the existing description when the action provides one', () => {
    render(
      <ActionCard
        action={{ ...baseAction, description: 'Validar a correção antes da próxima revisão.' }}
        canEdit={false}
        onTransition={vi.fn()}
        onReopenRequest={vi.fn()}
      />,
    );

    expect(screen.getByText('Validar a correção antes da próxima revisão.')).toBeInTheDocument();
  });

  it("shows the origin, responsible and due-on metadata fields, and links the origin to the risk's own detail route", () => {
    render(
      <ActionCard
        action={baseAction}
        canEdit={false}
        onTransition={vi.fn()}
        onReopenRequest={vi.fn()}
      />,
    );

    const originLink = screen.getByRole('link', { name: baseAction.originLabel! });
    expect(originLink).toHaveAttribute('href', '/risks/risk-1');
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('01/05/2026')).toBeInTheDocument();
  });

  it('renders the origin as plain text (never a broken link) when the origin type has no detail route', () => {
    render(
      <ActionCard
        action={{ ...baseAction, originType: 'FINDING', originLabel: undefined }}
        canEdit={false}
        onTransition={vi.fn()}
        onReopenRequest={vi.fn()}
      />,
    );

    expect(screen.getByText('Achado')).toBeInTheDocument();
  });

  it('shows the overdue indicator only when the action is actually overdue', () => {
    const { rerender } = render(
      <ActionCard
        action={baseAction}
        canEdit={false}
        onTransition={vi.fn()}
        onReopenRequest={vi.fn()}
      />,
    );
    expect(screen.queryByText('Atrasada')).not.toBeInTheDocument();

    rerender(
      <ActionCard
        action={{ ...baseAction, overdue: true }}
        canEdit={false}
        onTransition={vi.fn()}
        onReopenRequest={vi.fn()}
      />,
    );
    expect(screen.getByText('Atrasada')).toBeInTheDocument();
  });

  it('renders no row-actions menu when canEdit is false (FR-042 — advisory only)', () => {
    render(
      <ActionCard
        action={baseAction}
        canEdit={false}
        onTransition={vi.fn()}
        onReopenRequest={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Ações' })).not.toBeInTheDocument();
  });

  it('offers the same row-actions menu as the table view when canEdit is true, reachable from the card', async () => {
    const onTransition = vi.fn();
    render(
      <ActionCard
        action={baseAction}
        canEdit
        onTransition={onTransition}
        onReopenRequest={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ações' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Iniciar' }));
    expect(onTransition).toHaveBeenCalledWith(baseAction, 'IN_PROGRESS');
  });
});
