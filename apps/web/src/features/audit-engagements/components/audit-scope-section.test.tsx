import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditScopeSection } from './audit-scope-section';

import type { AuditScopeEntry } from '../types';

/**
 * Component-mount evidence for T076 (`AuditScopeSection`, US1, FR-005/
 * FR-006, ADR-020, research.md D-12). `../api` is mocked at the network
 * boundary. Loading, genuinely-empty and failed-to-load must stay three
 * distinguishable states (CLAUDE.md §18.11); the "não é possível remover"
 * reality and the "só editável em planejamento" rule must each be surfaced
 * honestly rather than worked around with a disabled button.
 */
const { listScopeMock } = vi.hoisted(() => ({ listScopeMock: vi.fn() }));

vi.mock('../api', () => ({
  auditEngagementsApi: {
    listScope: listScopeMock,
    listFrameworks: vi.fn().mockResolvedValue([]),
    listPublishedFrameworkVersions: vi.fn().mockResolvedValue([]),
    listRequirements: vi.fn().mockResolvedValue([]),
    listControls: vi.fn().mockResolvedValue([]),
  },
}));

function scopeEntry(overrides: Partial<AuditScopeEntry> = {}): AuditScopeEntry {
  return {
    id: 'scope-1',
    targetType: 'CONTROL',
    target: { id: 'control-1', label: 'CTL-2026-0001 — Revisão de acessos' },
    linkedAt: '2026-01-01T00:00:00.000Z',
    linkedBy: { id: 'user-1', fullName: 'Ana Souza' },
    ...overrides,
  };
}

describe('AuditScopeSection', () => {
  beforeEach(() => {
    listScopeMock.mockReset();
  });

  it('shows the genuinely-empty state (never a silent blank list) when no scope item exists yet', async () => {
    listScopeMock.mockResolvedValue([]);
    render(
      <AuditScopeSection
        auditId="engagement-1"
        engagementStatus="PLANNING"
        canManageScope
        onChanged={vi.fn()}
      />,
    );

    expect(
      await screen.findByText('Nenhum item no escopo deste engajamento ainda.'),
    ).toBeInTheDocument();
  });

  it('shows the failed-to-load state with a retry action, distinct from the empty state', async () => {
    listScopeMock.mockRejectedValueOnce(new Error('network down'));
    render(
      <AuditScopeSection
        auditId="engagement-1"
        engagementStatus="PLANNING"
        canManageScope
        onChanged={vi.fn()}
      />,
    );

    await screen.findByText('Não foi possível carregar o escopo deste engajamento.');
    expect(
      screen.queryByText('Nenhum item no escopo deste engajamento ainda.'),
    ).not.toBeInTheDocument();

    listScopeMock.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(listScopeMock).toHaveBeenCalledTimes(2));
  });

  it('lists every existing scope entry and states plainly that none of them can be removed (research.md D-12)', async () => {
    listScopeMock.mockResolvedValue([scopeEntry()]);
    render(
      <AuditScopeSection
        auditId="engagement-1"
        engagementStatus="PLANNING"
        canManageScope
        onChanged={vi.fn()}
      />,
    );

    expect(await screen.findByText('CTL-2026-0001 — Revisão de acessos')).toBeInTheDocument();
    expect(
      screen.getByText(/Não é possível remover um item do escopo depois de adicionado/),
    ).toBeInTheDocument();
    // No remove control is ever rendered — the notice above is the only
    // honest response to research.md D-12, never a disabled/broken button.
    expect(screen.queryByRole('button', { name: /[Rr]emover/ })).not.toBeInTheDocument();
  });

  it('offers the three scope-variant tabs only while PLANNING and only to a caller who can manage scope', async () => {
    listScopeMock.mockResolvedValue([]);
    const { rerender } = render(
      <AuditScopeSection
        auditId="engagement-1"
        engagementStatus="PLANNING"
        canManageScope
        onChanged={vi.fn()}
      />,
    );

    await screen.findByText('Nenhum item no escopo deste engajamento ainda.');
    expect(screen.getByRole('tab', { name: 'Versão de framework' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Requisito' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Controle' })).toBeInTheDocument();

    rerender(
      <AuditScopeSection
        auditId="engagement-1"
        engagementStatus="IN_PROGRESS"
        canManageScope
        onChanged={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getByText(
          'O escopo só pode ser alterado enquanto o engajamento está em planejamento. Depois de iniciado, o escopo fica fixo.',
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('tab', { name: 'Versão de framework' })).not.toBeInTheDocument();
  });

  it('never offers the scope-variant tabs to a caller without audit-engagement:scope, even in PLANNING', async () => {
    listScopeMock.mockResolvedValue([]);
    render(
      <AuditScopeSection
        auditId="engagement-1"
        engagementStatus="PLANNING"
        canManageScope={false}
        onChanged={vi.fn()}
      />,
    );

    await screen.findByText('Nenhum item no escopo deste engajamento ainda.');
    expect(screen.queryByRole('tab', { name: 'Versão de framework' })).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'O escopo só pode ser alterado enquanto o engajamento está em planejamento. Depois de iniciado, o escopo fica fixo.',
      ),
    ).not.toBeInTheDocument();
  });
});
