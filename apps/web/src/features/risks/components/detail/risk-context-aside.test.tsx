import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RiskAttentionAside, RiskRelationshipsAside } from './risk-context-aside';

import type { RiskDetail, RiskLifecycleState } from '../../types';

/**
 * Component-mount evidence for the contextual aside, split in two per P11
 * (016-risk-detail-experience §4.7, 2026-09-15): `RiskAttentionAside`
 * (`DetailLayout`'s `asideLead`) and `RiskRelationshipsAside`
 * (`DetailLayout`'s `aside`). This suite renders at the default (wide,
 * jsdom `matchMedia` stub) viewport, so every `RiskRelationshipsAside`
 * block is the plain, always-expanded section — `use-wide-viewport.test.ts`
 * -style narrow-mode coverage is not duplicated here (`vitest.setup.ts`
 * already documents why `matchMedia` defaults to `matches: true`).
 */

const baseRisk: RiskDetail = {
  id: 'risk-1',
  code: 'RSK-2026-0001',
  title: 'Falha no fornecedor crítico',
  descriptionExcerpt: 'Descrição.',
  description: 'Descrição.',
  status: 'IDENTIFIED',
  type: null,
  origin: null,
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  overdueReview: false,
  overdueTreatment: false,
  pendingApproval: false,
  version: 1,
  updatedAt: '2026-01-05T10:02:34.000Z',
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

describe('RiskAttentionAside', () => {
  it('renders nothing (not even a heading) when there is nothing pending — never an empty panel', () => {
    const { container } = render(
      <RiskAttentionAside risk={baseRisk} lifecycle={null} onNavigate={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows overdue review, and a treatment-actions summary that is accurate about WHAT is overdue (P9)', () => {
    render(
      <RiskAttentionAside
        risk={{ ...baseRisk, overdueReview: true, overdueTreatment: true }}
        lifecycle={null}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText('Atenção')).toBeInTheDocument();
    expect(screen.getByText('Revisão vencida.')).toBeInTheDocument();
    // Not "Tratamento vencido." — `overdueTreatment` reflects overdue
    // ACTIONS, independent of whether a treatment decision even exists
    // (P9); the sentence says so instead of implying the decision itself
    // has a deadline in the past.
    expect(screen.getByText('Há ações de tratamento em atraso.')).toBeInTheDocument();
    expect(screen.queryByText('Tratamento vencido.')).not.toBeInTheDocument();
  });

  it('points the overdue-treatment-actions item at "Planos de Ação", not "Tratamento" (P9)', () => {
    const onNavigate = vi.fn();
    render(
      <RiskAttentionAside
        risk={{ ...baseRisk, overdueTreatment: true }}
        lifecycle={null}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByText('Há ações de tratamento em atraso.'));
    expect(onNavigate).toHaveBeenCalledWith('action-plans');
  });

  it('names the blocked transition as a SHORT summary, never the full precondition sentence (P1)', () => {
    const lifecycle: RiskLifecycleState = {
      status: 'IDENTIFIED',
      pendingApproval: null,
      availableTransitions: [
        {
          toStatus: 'ASSESSED',
          requiredPermission: 'risk:assess',
          requiresApproval: false,
          preconditionsMet: false,
          unmetPreconditions: ['É necessário haver ao menos uma avaliação registrada.'],
        },
      ],
      traversedStatuses: ['DRAFT', 'IDENTIFIED'],
    };
    render(<RiskAttentionAside risk={baseRisk} lifecycle={lifecycle} onNavigate={vi.fn()} />);
    expect(screen.getByText('Transição para "Avaliado" bloqueada')).toBeInTheDocument();
    // The full sentence belongs to `RiskLifecycleActions` alone now — never
    // duplicated here.
    expect(
      screen.queryByText('É necessário haver ao menos uma avaliação registrada.'),
    ).not.toBeInTheDocument();
  });

  it('collapses multiple unmet preconditions of the SAME blocked transition into one item, not one per precondition string', () => {
    const lifecycle: RiskLifecycleState = {
      status: 'IDENTIFIED',
      pendingApproval: null,
      availableTransitions: [
        {
          toStatus: 'ASSESSED',
          requiredPermission: 'risk:assess',
          requiresApproval: false,
          preconditionsMet: false,
          unmetPreconditions: ['Motivo 1.', 'Motivo 2.'],
        },
      ],
      traversedStatuses: ['DRAFT', 'IDENTIFIED'],
    };
    render(<RiskAttentionAside risk={baseRisk} lifecycle={lifecycle} onNavigate={vi.fn()} />);
    expect(screen.getAllByText('Transição para "Avaliado" bloqueada')).toHaveLength(1);
  });
});

function relationshipsProps(
  overrides: Partial<React.ComponentProps<typeof RiskRelationshipsAside>> = {},
) {
  return {
    risk: baseRisk,
    activeSectionId: 'overview',
    canAssess: false,
    canTreat: false,
    canCreateEvidence: false,
    canComment: false,
    canViewEvidence: false,
    canViewFindings: false,
    ...overrides,
  };
}

describe('RiskRelationshipsAside', () => {
  it('omits "Ações rápidas" entirely when the caller holds none of the six permissions', () => {
    render(<RiskRelationshipsAside {...relationshipsProps()} />);
    expect(screen.queryByText('Ações rápidas')).not.toBeInTheDocument();
  });

  // Corrected 2026-09-17: a full E2E regression found TWO controls named
  // "Comentar" on screen at once — this shortcut (a `<button>` before this
  // fix) and `RiskCommentsSection`'s own real submit button, whenever the
  // Comentários section happened to be open. A control that only ever
  // changes `?section=` is a link, never a button (§18.8, §18.11) — `role`
  // is what actually resolves the collision, since `role="link"` and
  // `role="button"` sharing a name is not ambiguous the way two buttons
  // sharing one would be.
  it('offers only the quick actions the caller actually holds the permission for, as LINKS (not buttons)', () => {
    render(
      <RiskRelationshipsAside {...relationshipsProps({ canAssess: true, canComment: true })} />,
    );
    expect(screen.getByRole('link', { name: 'Registrar avaliação' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Comentar' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Registrar decisão de tratamento' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vincular controle' })).not.toBeInTheDocument();
    // Never rendered as a button anywhere on this component, permission
    // held or not.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers "Criar plano de ação" on risk:treat alone, with no current-treatment condition (corrected 2026-09-15)', () => {
    render(<RiskRelationshipsAside {...relationshipsProps({ canTreat: true })} />);
    expect(screen.getByRole('link', { name: 'Criar plano de ação' })).toBeInTheDocument();
  });

  it("points each quick-action link at ?section=<id> on the risk's own URL, never a synthetic click handler", () => {
    render(<RiskRelationshipsAside {...relationshipsProps({ canTreat: true })} />);
    expect(screen.getByRole('link', { name: 'Criar plano de ação' })).toHaveAttribute(
      'href',
      '/risks/risk-1?section=action-plans',
    );
  });

  it('shows the always-present relationship rows with their real counts', () => {
    const risk: RiskDetail = {
      ...baseRisk,
      controls: [
        {
          id: 'link-1',
          control: { id: 'c1', code: 'CTL-1', name: 'Controle' },
          linkedBy: { id: 'user-1', fullName: 'Ana Souza' },
          linkedAt: '2026-01-01T00:00:00.000Z',
          unlinkedBy: null,
          unlinkedAt: null,
        },
      ],
    };
    render(<RiskRelationshipsAside {...relationshipsProps({ risk })} />);
    expect(screen.getByText('Controles (1)')).toBeInTheDocument();
    expect(screen.getByText('Planos de ação (0)')).toBeInTheDocument();
  });

  it('marks a count-less relationship (Incidentes/Problemas) with a "Ver" hint, distinct from a real zero count (P6), as a LINK', () => {
    render(<RiskRelationshipsAside {...relationshipsProps()} />);
    // Accessible name concatenates the label and the hint — "Incidentes Ver",
    // never a bare number and never indistinguishable from an empty state.
    expect(screen.getByRole('link', { name: 'Incidentes Ver' })).toHaveAttribute(
      'href',
      '/risks/risk-1?section=incidents',
    );
    expect(screen.getByRole('link', { name: 'Problemas Ver' })).toHaveAttribute(
      'href',
      '/risks/risk-1?section=problems',
    );
    expect(screen.queryByText('Incidentes (0)')).not.toBeInTheDocument();
  });

  it('gives every relationship row a navigation affordance (a trailing chevron), not just plain text (P6)', () => {
    render(<RiskRelationshipsAside {...relationshipsProps()} />);
    const row = screen.getByRole('link', { name: 'Incidentes Ver' });
    expect(row.querySelector('svg')).not.toBeNull();
  });

  it('omits Evidências/Achados from relationships without the matching view permission, and shows them with it', () => {
    const { rerender } = render(<RiskRelationshipsAside {...relationshipsProps()} />);
    expect(screen.queryByText('Evidências', { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText('Achados', { exact: false })).not.toBeInTheDocument();

    rerender(
      <RiskRelationshipsAside
        {...relationshipsProps({ canViewEvidence: true, canViewFindings: true })}
      />,
    );
    expect(screen.getByRole('link', { name: 'Evidências Ver' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Achados (da unidade organizacional) Ver' }),
    ).toBeInTheDocument();
  });

  it("marks the currently open section's relationship row", () => {
    render(<RiskRelationshipsAside {...relationshipsProps({ activeSectionId: 'controls' })} />);
    expect(screen.getByRole('link', { name: 'Controles (0)' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Incidentes Ver' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows the last updated timestamp WITHOUT seconds (P8)', () => {
    render(<RiskRelationshipsAside {...relationshipsProps()} />);
    expect(screen.getByText('Última atualização')).toBeInTheDocument();
    // Computed the same way the component does, in THIS process's own
    // timezone — asserting a hardcoded clock time here would pass or fail
    // depending on the machine running the suite, not on the component's
    // own correctness (the real, previously-failing case: a UTC fixture
    // read back as a different local hour on CI).
    const expected = new Date(baseRisk.updatedAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/:34/)).not.toBeInTheDocument();
  });
});
