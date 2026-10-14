import { fireEvent, render, screen, within } from '@testing-library/react';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { common } from '@/lib/messages/common';
import { risks } from '@/lib/messages/risks';
import {
  ActivityHistory,
  AttachmentList,
  AuditTimeline,
  CommentThread,
  ConfirmDialog,
  DetailLayout,
  DetailPanel,
  DisclosureGroup,
  EmptyState,
  EmptyValue,
  EntityHeader,
  EntityTabs,
  ErrorState,
  FormField,
  FormSection,
  LoadingState,
  MetricCard,
  PageHeader,
  ReadOnlyField,
  RiskLevelBadge,
  RiskMatrix,
  RiskScore,
  SearchablePicker,
  StatusBadge,
  ThresholdBreachBadge,
  TrendChart,
} from '@vertice/design-system/components';

import type {
  ActivityHistoryEntry,
  ActivityHistoryLabels,
  AttachmentListItem,
  AttachmentListLabels,
  AuditTimelineEntry,
  AuditTimelineLabels,
  CommentThreadItem,
  CommentThreadLabels,
  RiskLevel,
  RiskMatrixCell,
  RiskMatrixLabels,
  RiskMatrixScaleLevel,
  RiskScoreLabels,
  TrendChartLabels,
  TrendChartPoint,
  TrendChartSeriesDef,
} from '@vertice/design-system/components';

describe('PageHeader', () => {
  it('renders a title, description and actions', () => {
    render(
      <PageHeader
        title="Inventário de riscos"
        description="Todos os riscos identificados"
        actions={<button>Novo risco</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Inventário de riscos' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Todos os riscos identificados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Novo risco' })).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('distinguishes "empty" from "no-results"', () => {
    const { rerender } = render(<EmptyState variant="empty" />);
    expect(screen.getByText('Nada por aqui ainda')).toBeInTheDocument();

    rerender(<EmptyState variant="no-results" />);
    expect(
      screen.getByText('Nenhum resultado encontrado para os filtros aplicados'),
    ).toBeInTheDocument();
  });
});

describe('EmptyValue', () => {
  it('keeps the placeholder word in the DOM, only reducing its visual weight (CLAUDE.md §18.11)', () => {
    render(<EmptyValue>Nunca acessou</EmptyValue>);
    const value = screen.getByText('Nunca acessou');
    expect(value).toBeInTheDocument();
    expect(value.className).toContain('italic');
  });
});

describe('LoadingState', () => {
  it('announces loading to assistive technology', () => {
    render(<LoadingState variant="table" rows={3} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});

describe('ErrorState', () => {
  it('renders only title/detail/correlationId from a problem+json payload — never a stack trace', () => {
    render(
      <ErrorState
        problem={{
          title: 'Risco não encontrado',
          detail: 'O risco solicitado não existe ou você não tem acesso a ele.',
          correlationId: 'corr-abc-123',
        }}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Risco não encontrado')).toBeInTheDocument();
    expect(screen.getByText(/não existe/)).toBeInTheDocument();
    expect(screen.getByText(/corr-abc-123/)).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('conveys meaning through icon + text, not color alone', () => {
    render(<StatusBadge variant="danger" label="Atrasado" />);
    const badge = screen.getByText('Atrasado');
    expect(badge.parentElement?.querySelector('svg')).not.toBeNull();
  });

  it('never claims to be a live region (role="status") — see LoadingState for why', () => {
    render(<StatusBadge variant="danger" label="Atrasado" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('RiskLevelBadge', () => {
  it.each([
    ['LOW', 'Baixo'],
    ['MEDIUM', 'Médio'],
    ['HIGH', 'Alto'],
    ['CRITICAL', 'Crítico'],
  ] as const)('renders %s with an icon and the text label "%s"', (level, label) => {
    render(<RiskLevelBadge level={level} labels={risks.riskLevelBadge} />);
    const badge = screen.getByText(label);
    expect(badge.parentElement?.querySelector('svg')).not.toBeNull();
  });

  it('prefixes the basis when provided (inherent vs residual are distinct values)', () => {
    render(<RiskLevelBadge level="HIGH" basis="residual" labels={risks.riskLevelBadge} />);
    expect(screen.getByText('Residual: Alto')).toBeInTheDocument();
  });

  it('still renders the same accessible name as before the labels-prop refactor (D-10)', () => {
    render(<RiskLevelBadge level="CRITICAL" basis="inherent" labels={risks.riskLevelBadge} />);
    expect(screen.getByLabelText('Nível de risco: Inerente: Crítico')).toBeInTheDocument();
  });

  it('never claims to be a live region (role="status") — see LoadingState for why', () => {
    render(<RiskLevelBadge level="HIGH" labels={risks.riskLevelBadge} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('RiskMatrix', () => {
  const probabilityScale: RiskMatrixScaleLevel[] = [
    { value: 1, label: 'Baixa' },
    { value: 2, label: 'Média' },
    { value: 3, label: 'Alta' },
  ];
  const impactScale: RiskMatrixScaleLevel[] = [
    { value: 1, label: 'Baixo' },
    { value: 2, label: 'Moderado' },
    { value: 3, label: 'Grave' },
    { value: 4, label: 'Crítico' },
  ];

  function levelForScore(score: number): RiskLevel {
    if (score <= 2) return 'LOW';
    if (score <= 6) return 'MEDIUM';
    if (score <= 9) return 'HIGH';
    return 'CRITICAL';
  }

  const matrix: RiskMatrixCell[] = probabilityScale.flatMap((probability) =>
    impactScale.map((impact) => {
      const score = probability.value * impact.value;
      return {
        probabilityValue: probability.value,
        impactValue: impact.value,
        score,
        level: levelForScore(score),
      };
    }),
  );

  const labels: RiskMatrixLabels = {
    probabilityAxisLabel: 'Probabilidade',
    impactAxisLabel: 'Impacto',
    cornerCellLabel: 'Probabilidade \\ Impacto',
    levelName: risks.riskLevelBadge.levelName,
    basisName: (basis) => (basis === 'inherent' ? 'Inerente' : 'Residual'),
    basisAbbreviation: (basis) => (basis === 'inherent' ? 'I' : 'R'),
    cellAccessibleLabel: ({ probabilityLabel, impactLabel, score, levelLabel }) =>
      `Probabilidade ${probabilityLabel}, Impacto ${impactLabel}: pontuação ${score}, nível ${levelLabel}`,
    caption: 'Matriz de risco',
  };

  it('renders a non-5x5 matrix with row and column headers taken from the supplied scales', () => {
    render(
      <RiskMatrix
        probabilityScale={probabilityScale}
        impactScale={impactScale}
        matrix={matrix}
        labels={labels}
      />,
    );

    const table = screen.getByRole('table', { name: 'Matriz de risco' });
    for (const impact of impactScale) {
      expect(within(table).getByRole('columnheader', { name: impact.label })).toBeInTheDocument();
    }
    for (const probability of probabilityScale) {
      expect(within(table).getByRole('rowheader', { name: probability.label })).toBeInTheDocument();
    }
  });

  it('makes highlighted inherent and residual cells distinguishable from each other and from unhighlighted cells, by something other than colour', () => {
    render(
      <RiskMatrix
        probabilityScale={probabilityScale}
        impactScale={impactScale}
        matrix={matrix}
        highlighted={[
          { probabilityValue: 3, impactValue: 4, basis: 'inherent' },
          { probabilityValue: 2, impactValue: 2, basis: 'residual' },
        ]}
        labels={labels}
      />,
    );

    expect(
      screen.getByRole('img', {
        name: 'Probabilidade Alta, Impacto Crítico: pontuação 12, nível Crítico (Inerente)',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('img', {
        name: 'Probabilidade Média, Impacto Moderado: pontuação 4, nível Médio (Residual)',
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('img', {
        name: 'Probabilidade Baixa, Impacto Baixo: pontuação 1, nível Baixo',
      }),
    ).toBeInTheDocument();
  });

  it('does not make cells focusable when onCellSelect is omitted', () => {
    render(
      <RiskMatrix
        probabilityScale={probabilityScale}
        impactScale={impactScale}
        matrix={matrix}
        labels={labels}
      />,
    );

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('turns cells into real buttons and invokes onCellSelect when supplied', () => {
    const onCellSelect = vi.fn();
    render(
      <RiskMatrix
        probabilityScale={probabilityScale}
        impactScale={impactScale}
        matrix={matrix}
        labels={labels}
        onCellSelect={onCellSelect}
      />,
    );

    const button = screen.getByRole('button', {
      name: 'Probabilidade Baixa, Impacto Baixo: pontuação 1, nível Baixo',
    });
    button.click();

    expect(onCellSelect).toHaveBeenCalledWith({
      probabilityValue: 1,
      impactValue: 1,
      score: 1,
      level: 'LOW',
    });
  });
});

describe('RiskScore', () => {
  const labels: RiskScoreLabels = {
    basisName: (basis) => (basis === 'inherent' ? 'Inerente' : 'Residual'),
    levelName: risks.riskLevelBadge.levelName,
    scoreCaption: ({ basisLabel, score, levelLabel }) =>
      `Pontuação ${basisLabel.toLowerCase()}: ${score} (${levelLabel})`,
    notAssessedCaption: (basisLabel) => `Risco ${basisLabel.toLowerCase()} ainda não avaliado.`,
    riskLevelBadge: risks.riskLevelBadge,
  };

  it('renders the score, level and basis together', () => {
    render(<RiskScore score={12} level="CRITICAL" basis="inherent" labels={labels} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Inerente: Crítico')).toBeInTheDocument();
  });

  it('renders the not-yet-assessed state explicitly, never as 0 or an empty box', () => {
    render(<RiskScore score={null} level={null} basis="residual" labels={labels} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByText('Risco residual ainda não avaliado.')).toBeInTheDocument();
  });

  it('never claims to be a live region (role="status") for the not-yet-assessed message', () => {
    render(<RiskScore score={null} level={null} basis="inherent" labels={labels} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('MetricCard', () => {
  it('renders a single-value metric with the value dominant and metadata subordinate beneath it', () => {
    render(
      <MetricCard
        label="Percentual de conformidade"
        orgUnitLabel="Organização inteira"
        updatedAtLabel="Atualizado em 12/09/2026 14:32"
        value={{ status: 'available', shape: 'single', value: '82', unit: '%' }}
      />,
    );
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(screen.getByText('Percentual de conformidade')).toBeInTheDocument();
    expect(screen.getByText('Atualizado em 12/09/2026 14:32')).toBeInTheDocument();
  });

  it('renders a by-bucket metric reusing RiskLevelBadge per band, never a second severity vocabulary', () => {
    render(
      <MetricCard
        label="Total de riscos por nível"
        value={{
          status: 'available',
          shape: 'byBucket',
          buckets: [
            { level: 'LOW', count: 4 },
            { level: 'MEDIUM', count: 9 },
            { level: 'HIGH', count: 2 },
            { level: 'CRITICAL', count: 1 },
          ],
          badgeLabels: risks.riskLevelBadge,
        }}
      />,
    );
    expect(screen.getByText('Baixo')).toBeInTheDocument();
    expect(screen.getByText('Crítico')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('renders the unavailable state distinctly from a computed zero, never a bare "0"', () => {
    render(
      <MetricCard
        label="Percentual de conformidade"
        value={{
          status: 'unavailable',
          unavailableLabel: 'Sem permissão para ver esta métrica',
          unavailableHint: 'Solicite acesso ao domínio de origem.',
        }}
      />,
    );
    expect(screen.getByText('Sem permissão para ver esta métrica')).toBeInTheDocument();
    expect(screen.getByText('Solicite acesso ao domínio de origem.')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});

describe('ThresholdBreachBadge', () => {
  it('conveys a breach through icon + text, not color alone', () => {
    render(<ThresholdBreachBadge breached label="Limiar rompido" />);
    const badge = screen.getByText('Limiar rompido');
    expect(badge.parentElement?.querySelector('svg')).not.toBeNull();
  });

  it('conveys "within threshold" distinctly from a breach, with its own icon + text', () => {
    render(<ThresholdBreachBadge breached={false} label="Dentro do limiar" />);
    const badge = screen.getByText('Dentro do limiar');
    expect(badge.parentElement?.querySelector('svg')).not.toBeNull();
  });
});

describe('TrendChart', () => {
  const points: TrendChartPoint[] = [
    { key: '2026-06-01', label: 'Jun/2026', values: { value: 10 } },
    { key: '2026-07-01', label: 'Jul/2026', values: { value: 14 } },
  ];
  const seriesDefs: TrendChartSeriesDef[] = [
    { id: 'value', label: 'Valor', color: 'var(--chart-1)' },
  ];
  const labels: TrendChartLabels = {
    tableCaption: 'Histórico do indicador',
    dateColumnLabel: 'Data',
    emptyState: 'Nenhum ponto histórico registrado ainda.',
  };

  it('renders an always-present accessible table with the same values the chart draws', () => {
    render(<TrendChart points={points} seriesDefs={seriesDefs} labels={labels} />);
    const table = screen.getByRole('table', { name: 'Histórico do indicador' });
    expect(within(table).getByRole('columnheader', { name: 'Data' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Valor' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Jun/2026' })).toBeInTheDocument();
    expect(within(table).getByText('10')).toBeInTheDocument();
    expect(within(table).getByText('14')).toBeInTheDocument();
  });

  it('renders an explicit empty state, never an empty chart/table, when there are no points', () => {
    render(<TrendChart points={[]} seriesDefs={seriesDefs} labels={labels} />);
    expect(screen.getByText('Nenhum ponto histórico registrado ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('states what will happen and requires explicit confirmation', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Arquivar este risco?"
        description="Este risco será movido para Arquivados e removido das visualizações ativas. Esta ação não pode ser desfeita."
        variant="destructive"
        labels={{
          confirm: 'Arquivar',
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText('Arquivar este risco?')).toBeInTheDocument();
    expect(screen.getByText(/não pode ser desfeita/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arquivar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('gives the "sensitive" tier its own tone, distinct from an ordinary or a destructive confirmation (wave 4, CLAUDE.md §18.11)', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Desativar usuário?"
        description="Todas as sessões ativas dessa conta serão encerradas imediatamente."
        variant="sensitive"
        labels={{
          confirm: 'Desativar',
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        onConfirm={vi.fn()}
      />,
    );
    const confirmButton = screen.getByRole('button', { name: 'Desativar' });
    expect(confirmButton.className).toContain('status-warning-solid');
    expect(confirmButton.className).not.toContain('bg-destructive');
  });

  it('renders an optional icon beside the title without breaking a caller that omits it', () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Redefinir senha?"
        description="A senha atual deixará de funcionar."
        variant="sensitive"
        icon={KeyRound}
        labels={{ confirm: 'Redefinir', cancel: 'Cancelar', close: 'Fechar' }}
        onConfirm={vi.fn()}
      />,
    );
    expect(document.querySelector('svg.text-status-warning-fg')).not.toBeNull();
  });
});

describe('FormField', () => {
  it('associates the label, description and error with the control via aria-describedby (T093)', () => {
    render(
      <FormField label="Título" required description="Texto de apoio" error="Campo obrigatório">
        {(field) => <input {...field} />}
      </FormField>,
    );

    const input = screen.getByRole('textbox', { name: /^Título/ });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(screen.getByText('Texto de apoio').id).toBe(describedBy?.split(' ')[0]);
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
    expect(screen.getByText('(obrigatório)')).toBeInTheDocument();
  });

  it('omits aria-invalid/error wiring when there is no error', () => {
    render(<FormField label="Descrição">{(field) => <textarea {...field} />}</FormField>);
    const control = screen.getByRole('textbox', { name: 'Descrição' });
    expect(control).toHaveAttribute('aria-invalid', 'false');
  });

  it("shows a caller-supplied optional marker next to the label without changing the label's own accessible name (CLAUDE.md §18, required/optional convention)", () => {
    render(
      <FormField label="Categoria" optionalIndicator="(opcional)">
        {(field) => <input {...field} />}
      </FormField>,
    );
    expect(screen.getByRole('textbox', { name: 'Categoria' })).toBeInTheDocument();
    expect(screen.getByText('(opcional)')).toBeInTheDocument();
  });

  it('never shows the optional marker for a required field, even when one is supplied', () => {
    render(
      <FormField label="Título" required optionalIndicator="(opcional)">
        {(field) => <input {...field} />}
      </FormField>,
    );
    expect(screen.queryByText('(opcional)')).not.toBeInTheDocument();
  });

  it('shows no optional marker at all when the caller supplies none — a pre-existing form keeps rendering exactly as before this prop existed', () => {
    render(<FormField label="Origem">{(field) => <input {...field} />}</FormField>);
    expect(screen.queryByText('(opcional)')).not.toBeInTheDocument();
  });

  it('conveys a validation error with an icon in addition to color and text (§18.8 — never color alone)', () => {
    render(
      <FormField label="Título" error="Informe um título.">
        {(field) => <input {...field} />}
      </FormField>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Informe um título.');
    expect(alert.querySelector('svg')).not.toBeNull();
  });
});

describe('ReadOnlyField', () => {
  it('renders as plain dt/dd text — never a bordered input-like box, so it cannot be mistaken for something editable', () => {
    render(<ReadOnlyField label="Unidade organizacional" value="Vértice GRC" />);
    expect(screen.getByText('Unidade organizacional')).toBeInTheDocument();
    const value = screen.getByText('Vértice GRC');
    expect(value.tagName).toBe('DD');
    expect(value.className).not.toMatch(/border|shadow|ring/);
  });

  it('accepts a composed ReactNode value, not only a plain string', () => {
    render(<ReadOnlyField label="Situação" value={<span data-testid="chip">Ativo</span>} />);
    expect(screen.getByTestId('chip')).toBeInTheDocument();
  });
});

describe('FormSection', () => {
  it('groups fields under a native fieldset/legend', () => {
    render(
      <FormSection title="Classificação" description="Como este risco é categorizado">
        <p>conteúdo</p>
      </FormSection>,
    );
    expect(screen.getByRole('group', { name: 'Classificação' })).toBeInTheDocument();
    expect(screen.getByText('Como este risco é categorizado')).toBeInTheDocument();
  });
});

describe('EntityHeader', () => {
  it('renders the record code, title and badges together', () => {
    render(
      <EntityHeader
        code="RSK-2026-0001"
        title="Falha no fornecedor crítico"
        badges={<StatusBadge variant="neutral" label="Rascunho" />}
        metadata={<span>Gestor: Ana Souza</span>}
        actions={<button>Editar</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Falha no fornecedor crítico' }),
    ).toBeInTheDocument();
    expect(screen.getByText('RSK-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('Gestor: Ana Souza')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });
});

describe('EntityTabs', () => {
  const scrollLabels = {
    scrollBack: common.entityTabs.scrollBack,
    scrollForward: common.entityTabs.scrollForward,
  };

  it('omits a section with visible=false entirely, rather than rendering it disabled (FR-094)', () => {
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        tabs={[
          { id: 'overview', label: 'Visão geral', content: <p>overview content</p> },
          { id: 'audit', label: 'Auditoria', content: <p>audit content</p>, visible: false },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Auditoria' })).not.toBeInTheDocument();
    expect(screen.queryByText('audit content')).not.toBeInTheDocument();
  });

  it('renders nothing when every tab is hidden', () => {
    const { container } = render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        tabs={[{ id: 'audit', label: 'Auditoria', content: <p />, visible: false }]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders no scroll affordance when the tab strip fits its container', () => {
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        tabs={[
          { id: 'a', label: 'Aba A', content: <p /> },
          { id: 'b', label: 'Aba B', content: <p /> },
        ]}
      />,
    );
    expect(
      screen.queryByRole('button', { name: scrollLabels.scrollForward }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: scrollLabels.scrollBack })).not.toBeInTheDocument();
  });

  it('shows only the forward chevron when content overflows to the right, and it actually scrolls on click', () => {
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(2000);
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(300);
    try {
      render(
        <EntityTabs
          ariaLabel={common.entityTabs.sectionsAriaLabel}
          scrollLabels={scrollLabels}
          tabs={[
            { id: 'a', label: 'Aba A', content: <p /> },
            { id: 'b', label: 'Aba B', content: <p /> },
          ]}
        />,
      );
      expect(
        screen.queryByRole('button', { name: scrollLabels.scrollBack }),
      ).not.toBeInTheDocument();
      const forwardButton = screen.getByRole('button', { name: scrollLabels.scrollForward });

      const container = screen.getByRole('tablist').parentElement!;
      const scrollBySpy = vi.fn();
      container.scrollBy = scrollBySpy;

      fireEvent.click(forwardButton);
      expect(scrollBySpy).toHaveBeenCalledWith({ left: 160, behavior: 'smooth' });
    } finally {
      scrollWidthSpy.mockRestore();
      clientWidthSpy.mockRestore();
    }
  });

  it('reveals the back chevron once the strip has actually scrolled away from its start', () => {
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(2000);
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(300);
    try {
      render(
        <EntityTabs
          ariaLabel={common.entityTabs.sectionsAriaLabel}
          scrollLabels={scrollLabels}
          tabs={[
            { id: 'a', label: 'Aba A', content: <p /> },
            { id: 'b', label: 'Aba B', content: <p /> },
          ]}
        />,
      );
      const container = screen.getByRole('tablist').parentElement!;
      expect(
        screen.queryByRole('button', { name: scrollLabels.scrollBack }),
      ).not.toBeInTheDocument();

      container.scrollLeft = 500;
      fireEvent.scroll(container);

      expect(screen.getByRole('button', { name: scrollLabels.scrollBack })).toBeInTheDocument();
    } finally {
      scrollWidthSpy.mockRestore();
      clientWidthSpy.mockRestore();
    }
  });

  it('lets a caller drive selection with value/onValueChange, reporting the click without switching on its own', () => {
    const onValueChange = vi.fn();
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        value="a"
        onValueChange={onValueChange}
        tabs={[
          { id: 'a', label: 'Aba A', content: <p>conteúdo A</p> },
          { id: 'b', label: 'Aba B', content: <p>conteúdo B</p> },
        ]}
      />,
    );

    expect(screen.getByText('conteúdo A')).toBeInTheDocument();
    const tabB = screen.getByRole('tab', { name: 'Aba B' });
    tabB.focus();
    fireEvent.click(tabB);

    expect(onValueChange).toHaveBeenCalledWith('b');
    expect(screen.getByText('conteúdo A')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo B')).not.toBeInTheDocument();
  });

  it('falls back a controlled value naming an absent/hidden tab to the first visible one, never to nothing selected', () => {
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        value="does-not-exist"
        onValueChange={() => undefined}
        tabs={[
          { id: 'a', label: 'Aba A', content: <p>conteúdo A</p> },
          { id: 'b', label: 'Aba B', content: <p>conteúdo B</p> },
        ]}
      />,
    );

    expect(screen.getByText('conteúdo A')).toBeInTheDocument();
  });

  it('wraps a "compact" tab strip onto multiple lines BELOW sm ONLY — identical to "default" at sm and wider (V1/V2)', () => {
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        size="compact"
        tabs={[
          { id: 'a', label: 'Aba A', content: <p /> },
          { id: 'b', label: 'Aba B', content: <p /> },
          { id: 'c', label: 'Aba C', content: <p /> },
        ]}
      />,
    );

    const list = screen.getByRole('tablist');
    expect(list.className).toContain('max-sm:flex-wrap');
    expect(list.className).toContain('max-sm:w-full');
    expect(list.className).not.toContain('grid');
    expect(list.style.gridTemplateColumns).toBe('');
    expect(list.className).toContain('inline-flex');
    expect(list.className).toContain('w-fit');
  });

  it('never forces a "compact" tab narrower than its own label — each tab keeps whitespace-nowrap and its natural content width', () => {
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        size="compact"
        tabs={[{ id: 'a', label: 'Relacionamentos', content: <p /> }]}
      />,
    );

    const tab = screen.getByRole('tab', { name: 'Relacionamentos' });
    expect(tab.className).toContain('whitespace-nowrap');
    expect(tab.className).not.toContain('break-words');
    expect(tab.className).not.toContain('flex-col');
  });

  it('gives a "subordinate" strip a lighter, underline treatment instead of the filled pill container — visibly different from the level above it', () => {
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        subordinate
        tabs={[
          { id: 'a', label: 'Aba A', content: <p>conteúdo A</p> },
          { id: 'b', label: 'Aba B', content: <p>conteúdo B</p> },
        ]}
      />,
    );

    const list = screen.getByRole('tablist');
    expect(list.className).not.toContain('bg-muted');
    const tabA = screen.getByRole('tab', { name: 'Aba A' });
    expect(tabA.className).toContain('border-b-2');
    expect(tabA.className).not.toContain('rounded-md');
  });

  it('defaults to the original inline pill row when neither size nor subordinate is passed — every caller before P3/P4 unchanged', () => {
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        tabs={[{ id: 'a', label: 'Aba A', content: <p /> }]}
      />,
    );

    const list = screen.getByRole('tablist');
    expect(list.className).toContain('inline-flex');
    expect(list.className).toContain('bg-muted');
  });

  it("keeps a tab's accessible name exactly its label when an icon is supplied — the icon never joins the name", () => {
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        tabs={[{ id: 'a', label: 'Visão geral', icon: KeyRound, content: <p /> }]}
      />,
    );

    const tab = screen.getByRole('tab', { name: 'Visão geral' });
    expect(tab).toBeInTheDocument();
    expect(tab.querySelector('svg')).toBeInTheDocument();
    expect(tab.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('ignores an icon passed to a "subordinate" (level-2) tab — hierarchy is enforced by the component, not by caller discipline', () => {
    render(
      <EntityTabs
        ariaLabel={common.entityTabs.sectionsAriaLabel}
        scrollLabels={scrollLabels}
        subordinate
        tabs={[{ id: 'a', label: 'Avaliação', icon: KeyRound, content: <p /> }]}
      />,
    );

    const tab = screen.getByRole('tab', { name: 'Avaliação' });
    expect(tab.querySelector('svg')).not.toBeInTheDocument();
  });
});

describe('DetailLayout', () => {
  it('renders every slot it was given', () => {
    render(
      <DetailLayout
        header={<p>DLHEADER</p>}
        summary={<p>DLSUMMARY</p>}
        asideLead={<p>DLLEAD</p>}
        navigation={<p>DLNAV</p>}
        aside={<p>DLASIDE</p>}
      >
        <p>DLCHILDREN</p>
      </DetailLayout>,
    );

    expect(screen.getByText('DLHEADER')).toBeInTheDocument();
    expect(screen.getByText('DLSUMMARY')).toBeInTheDocument();
    expect(screen.getByText('DLNAV')).toBeInTheDocument();
    expect(screen.getByText('DLCHILDREN')).toBeInTheDocument();
    expect(screen.getAllByText('DLLEAD')).toHaveLength(2);
    expect(screen.getAllByText('DLASIDE')).toHaveLength(2);
  });

  it('promotes asideLead ABOVE navigation, and keeps aside AFTER children, in DOM/reading order (P11)', () => {
    const { container } = render(
      <DetailLayout
        header={<p>DLHEADER_3</p>}
        asideLead={<p data-testid="lead">DLLEAD_3</p>}
        navigation={<p data-testid="nav">DLNAV_3</p>}
        aside={<p data-testid="rest">DLREST_3</p>}
      >
        <p data-testid="children">DLCHILDREN_3</p>
      </DetailLayout>,
    );

    const narrowOrder = Array.from(container.querySelectorAll('[data-testid]'))
      .filter((el) => !el.closest('[class*="xl:sticky"]'))
      .map((el) => el.getAttribute('data-testid'));
    expect(narrowOrder).toEqual(['lead', 'nav', 'children', 'rest']);
  });

  it('omits the aside column and the summary band entirely when the caller has neither — no empty regions', () => {
    const { container } = render(
      <DetailLayout header={<p>DLHEADER_2</p>} navigation={<p>DLNAV_2</p>} />,
    );

    expect(screen.getByText('DLHEADER_2')).toBeInTheDocument();
    expect(screen.getByText('DLNAV_2')).toBeInTheDocument();
    expect(container.querySelector('[class*="order-2"]')).toBeNull();
  });

  it('gives the sticky aside column ONE named complementary landmark, when asideLabel is passed', () => {
    render(
      <DetailLayout
        header={<p>DLHEADER_4</p>}
        asideLead={<p>DLLEAD_4</p>}
        navigation={<p>DLNAV_4</p>}
        aside={<p>DLREST_4</p>}
        asideLabel="Contexto de teste"
      />,
    );

    const landmarks = screen.getAllByRole('complementary', { name: 'Contexto de teste' });
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0]!.className).toContain('xl:sticky');
  });

  it('never renders an unnamed landmark when the caller omits asideLabel — falls back to a plain div, exactly as before this prop existed', () => {
    render(
      <DetailLayout
        header={<p>DLHEADER_5</p>}
        asideLead={<p>DLLEAD_5</p>}
        navigation={<p>DLNAV_5</p>}
        aside={<p>DLREST_5</p>}
      />,
    );

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

describe('ActivityHistory', () => {
  const labels: ActivityHistoryLabels = {
    caption: 'Linha do tempo de teste',
    loading: 'Carregando linha do tempo…',
    loadError: 'Falha ao carregar a linha do tempo.',
    empty: 'Nenhum evento de teste.',
    recordedAtLabel: 'Registrado em (teste)',
    assertedDateLabel: 'Data informada (teste)',
    previousValueLabel: 'Valor anterior (teste)',
    newValueLabel: 'Valor novo (teste)',
    loadMoreLabel: 'Carregar mais eventos',
    loadingMoreLabel: 'Carregando mais eventos…',
  };

  it('renders entries as a real, navigable list — not a stack of divs', () => {
    const items: ActivityHistoryEntry[] = [
      {
        id: 'entry-1',
        kindLabel: 'Avaliação',
        occurredAtLabel: '05/09/2026 14:32',
        actorName: 'Ana Souza',
        summary: 'Avaliação registrada.',
      },
    ];
    render(<ActivityHistory items={items} labels={labels} />);
    const list = screen.getByRole('list', { name: labels.caption });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('renders the recorded instant and the asserted date as two separately labeled facts, never merged into one (F-9)', () => {
    const items: ActivityHistoryEntry[] = [
      {
        id: 'entry-1',
        kindLabel: 'Avaliação',
        occurredAtLabel: '05/09/2026 14:32',
        assertedDateLabel: '01/09/2026',
        actorName: 'Ana Souza',
        summary: 'Avaliação registrada: nível residual Baixo.',
      },
    ];
    render(<ActivityHistory items={items} labels={labels} />);
    expect(screen.getByText(labels.recordedAtLabel)).toBeInTheDocument();
    expect(screen.getByText('05/09/2026 14:32')).toBeInTheDocument();
    expect(screen.getByText(labels.assertedDateLabel)).toBeInTheDocument();
    expect(screen.getByText('01/09/2026')).toBeInTheDocument();
  });

  it('omits the asserted-date fact entirely for an entry that carries none (e.g. a lifecycle transition)', () => {
    const items: ActivityHistoryEntry[] = [
      {
        id: 'entry-1',
        kindLabel: 'Transição de status',
        occurredAtLabel: '05/09/2026 14:40',
        actorName: 'Ana Souza',
        summary: 'Status alterado de Identificado para Avaliado.',
      },
    ];
    render(<ActivityHistory items={items} labels={labels} />);
    expect(screen.queryByText(labels.assertedDateLabel)).not.toBeInTheDocument();
  });

  it('shows the loading state using the caller-supplied label', () => {
    render(<ActivityHistory items={[]} labels={labels} isLoading />);
    expect(screen.getByRole('status')).toHaveTextContent(labels.loading);
  });

  it('shows the error state from the caller-supplied problem, not a generic message', () => {
    render(
      <ActivityHistory
        items={[]}
        labels={labels}
        error={{ title: 'Falha de teste', detail: labels.loadError }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falha de teste');
    expect(screen.getByRole('alert')).toHaveTextContent(labels.loadError);
  });

  it('invokes onLoadMore from the caller-labeled control when a further page exists', () => {
    const onLoadMore = vi.fn();
    const items: ActivityHistoryEntry[] = [
      {
        id: 'entry-1',
        kindLabel: 'Avaliação',
        occurredAtLabel: '05/09/2026 14:32',
        actorName: 'Ana Souza',
        summary: 'Avaliação registrada.',
      },
    ];
    render(<ActivityHistory items={items} labels={labels} hasMore onLoadMore={onLoadMore} />);
    screen.getByRole('button', { name: labels.loadMoreLabel }).click();
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('is built entirely from caller-supplied props — holds no hardcoded copy of its own (D-10)', () => {
    const weirdLabels: ActivityHistoryLabels = {
      caption: 'CAPTION_9f3',
      loading: 'LOADING_9f3',
      loadError: 'LOADERROR_9f3',
      empty: 'EMPTY_9f3',
      recordedAtLabel: 'RECORDED_9f3',
      assertedDateLabel: 'ASSERTED_9f3',
      previousValueLabel: 'PREVIOUS_9f3',
      newValueLabel: 'NEW_9f3',
      loadMoreLabel: 'LOADMORE_9f3',
      loadingMoreLabel: 'LOADINGMORE_9f3',
    };

    const { rerender } = render(<ActivityHistory items={[]} labels={weirdLabels} />);
    expect(screen.getByText('EMPTY_9f3')).toBeInTheDocument();

    rerender(
      <ActivityHistory
        items={[
          {
            id: 'e1',
            kindLabel: 'KIND_9f3',
            occurredAtLabel: 'OCCURRED_9f3',
            assertedDateLabel: 'ASSERTEDVALUE_9f3',
            actorName: 'ACTOR_9f3',
            summary: 'SUMMARY_9f3',
            previousValue: 'PREVVALUE_9f3',
            newValue: 'NEWVALUE_9f3',
          },
        ]}
        labels={weirdLabels}
        hasMore
      />,
    );

    expect(screen.getByRole('list', { name: 'CAPTION_9f3' })).toBeInTheDocument();
    expect(screen.getByText('KIND_9f3')).toBeInTheDocument();
    expect(screen.getByText('RECORDED_9f3')).toBeInTheDocument();
    expect(screen.getByText('OCCURRED_9f3')).toBeInTheDocument();
    expect(screen.getByText('ASSERTED_9f3')).toBeInTheDocument();
    expect(screen.getByText('ASSERTEDVALUE_9f3')).toBeInTheDocument();
    expect(screen.getByText('SUMMARY_9f3')).toBeInTheDocument();
    expect(screen.getByText('PREVIOUS_9f3')).toBeInTheDocument();
    expect(screen.getByText('PREVVALUE_9f3')).toBeInTheDocument();
    expect(screen.getByText('NEW_9f3')).toBeInTheDocument();
    expect(screen.getByText('NEWVALUE_9f3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOADMORE_9f3' })).toBeInTheDocument();
    expect(screen.queryByText(/carregando|loading|nada por aqui/i)).not.toBeInTheDocument();
  });
});

describe('AuditTimeline', () => {
  const labels: AuditTimelineLabels = {
    caption: 'Trilha de auditoria de teste',
    loading: 'Carregando auditoria…',
    loadError: 'Falha ao carregar auditoria.',
    empty: 'Nenhum evento de auditoria.',
    occurredAtLabel: 'Ocorrido em (teste)',
    actorLabel: 'Ator (teste)',
    entityLabel: 'Entidade (teste)',
    notRecordedLabel: 'Não registrado (teste)',
    outcomeLabel: (outcome) => (outcome === 'SUCCESS' ? 'Sucesso (teste)' : 'Negado (teste)'),
    outcomeVariant: (outcome) => (outcome === 'SUCCESS' ? 'success' : 'danger'),
    changedFieldsLabel: 'Campos alterados (teste)',
    fieldLabel: (key) => key,
    ipAddressLabel: 'IP (teste)',
    userAgentLabel: 'Agente (teste)',
    correlationIdLabel: 'Correlação (teste)',
    loadMoreLabel: 'Carregar mais (teste)',
    loadingMoreLabel: 'Carregando mais (teste)',
  };

  const baseEntry: AuditTimelineEntry = {
    id: 'audit-1',
    occurredAtLabel: '05/09/2026 09:00',
    actorLabel: 'Ana Souza',
    action: 'risk.accepted',
    entityType: 'RISK',
    entityId: 'risk-123',
    outcome: 'SUCCESS',
    previousValues: { ownerUserId: 'user-1' },
    newValues: { ownerUserId: 'user-2' },
    ipAddress: '10.0.0.1',
    userAgent: 'Mozilla/5.0',
    correlationId: 'corr-abc',
  };

  it('renders entries as a real, navigable list — not a stack of divs', () => {
    render(<AuditTimeline items={[baseEntry]} labels={labels} />);
    const list = screen.getByRole('list', { name: labels.caption });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  });

  it('conveys the outcome through icon and text together, never colour alone, and never translates the raw action/entity identifiers (CLAUDE.md §11.1)', () => {
    render(<AuditTimeline items={[baseEntry]} labels={labels} />);
    const badge = screen.getByText('Sucesso (teste)');
    expect(badge.parentElement?.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('risk.accepted')).toBeInTheDocument();
    expect(screen.getByText('RISK')).toBeInTheDocument();
  });

  it('renders a before/after diff only for fields that actually changed', () => {
    render(<AuditTimeline items={[baseEntry]} labels={labels} />);
    expect(screen.getByText(labels.changedFieldsLabel)).toBeInTheDocument();
    expect(screen.getByText('ownerUserId:')).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
    expect(screen.getByText('user-2')).toBeInTheDocument();
  });

  it('omits the changed-fields block entirely when there is nothing to diff', () => {
    render(
      <AuditTimeline
        items={[{ ...baseEntry, previousValues: null, newValues: null }]}
        labels={labels}
      />,
    );
    expect(screen.queryByText(labels.changedFieldsLabel)).not.toBeInTheDocument();
  });

  it('is built entirely from caller-supplied props — holds no hardcoded copy of its own (D-10)', () => {
    const weirdLabels: AuditTimelineLabels = {
      caption: 'CAPTION_a1',
      loading: 'LOADING_a1',
      loadError: 'LOADERROR_a1',
      empty: 'EMPTY_a1',
      occurredAtLabel: 'OCCURRED_a1',
      actorLabel: 'ACTOR_a1',
      entityLabel: 'ENTITY_a1',
      notRecordedLabel: 'NOTRECORDED_a1',
      outcomeLabel: () => 'OUTCOME_a1',
      outcomeVariant: () => 'neutral',
      changedFieldsLabel: 'CHANGED_a1',
      fieldLabel: () => 'FIELDLABEL_a1',
      ipAddressLabel: 'IP_a1',
      userAgentLabel: 'UA_a1',
      correlationIdLabel: 'CORR_a1',
      loadMoreLabel: 'LOADMORE_a1',
      loadingMoreLabel: 'LOADINGMORE_a1',
    };

    render(
      <AuditTimeline
        items={[
          {
            id: 'audit-2',
            occurredAtLabel: 'OCCURREDVAL_a1',
            actorLabel: 'ACTORVAL_a1',
            action: 'risk.example',
            entityType: 'RISK',
            entityId: null,
            outcome: 'SUCCESS',
            previousValues: null,
            newValues: null,
            ipAddress: null,
            userAgent: null,
            correlationId: 'CORRVAL_a1',
          },
        ]}
        labels={weirdLabels}
        hasMore
      />,
    );

    expect(screen.getByRole('list', { name: 'CAPTION_a1' })).toBeInTheDocument();
    expect(screen.getByText('OCCURRED_a1')).toBeInTheDocument();
    expect(screen.getByText('OCCURREDVAL_a1')).toBeInTheDocument();
    expect(screen.getByText('ACTOR_a1')).toBeInTheDocument();
    expect(screen.getByText('ACTORVAL_a1')).toBeInTheDocument();
    expect(screen.getByText('ENTITY_a1')).toBeInTheDocument();
    expect(screen.getAllByText('NOTRECORDED_a1').length).toBeGreaterThan(0);
    expect(screen.getByText('OUTCOME_a1')).toBeInTheDocument();
    expect(screen.getByText('IP_a1')).toBeInTheDocument();
    expect(screen.getByText('UA_a1')).toBeInTheDocument();
    expect(screen.getByText('CORR_a1')).toBeInTheDocument();
    expect(screen.getByText('CORRVAL_a1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOADMORE_a1' })).toBeInTheDocument();
    expect(screen.queryByText(/carregando|loading|nada por aqui/i)).not.toBeInTheDocument();
  });

  const knownCategoryId = '01a071be-cd75-7571-93f1-8865c5c3d224';

  function emptyReferenceData(): Parameters<typeof risks.audit.buildValueResolver>[0] {
    return { categories: [], types: [], origins: [], orgUnits: [], users: [] };
  }

  it('renders a changed field with its pt-BR label, never the raw database column name', () => {
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { categoryId: null },
            newValues: { categoryId: knownCategoryId },
          },
        ]}
        labels={risks.audit}
      />,
    );
    expect(screen.getByText('Categoria:')).toBeInTheDocument();
    expect(screen.queryByText('categoryId:')).not.toBeInTheDocument();
  });

  it('resolves a category id to its name instead of showing the raw UUID', () => {
    const resolveFieldValue = risks.audit.buildValueResolver({
      ...emptyReferenceData(),
      categories: [
        {
          id: knownCategoryId,
          code: 'OPS',
          name: 'Operacional',
          description: null,
          sortOrder: 1,
          isActive: true,
        },
      ],
    });
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { categoryId: null },
            newValues: { categoryId: knownCategoryId },
          },
        ]}
        labels={{ ...risks.audit, resolveFieldValue }}
      />,
    );
    expect(screen.getByText(/Operacional/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(knownCategoryId))).not.toBeInTheDocument();
  });

  it('degrades an id that cannot be resolved (a deleted category) to a named placeholder that still shows the id, never a blank cell', () => {
    const resolveFieldValue = risks.audit.buildValueResolver(emptyReferenceData());
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { categoryId: null },
            newValues: { categoryId: 'deleted-category-id' },
          },
        ]}
        labels={{ ...risks.audit, resolveFieldValue }}
      />,
    );
    expect(screen.getByText(/Registro não encontrado \(deleted-category-id\)/)).toBeInTheDocument();
  });

  it('still renders a changed-field row for a key this catalog has no label for, falling back to the raw key (FR-035: the payload is Record<string, unknown>)', () => {
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { neverBeforeSeenField: 'A' },
            newValues: { neverBeforeSeenField: 'B' },
          },
        ]}
        labels={risks.audit}
      />,
    );
    expect(screen.getByText('neverBeforeSeenField:')).toBeInTheDocument();
  });

  it('keeps showing "Não registrado" for a genuinely absent previous value even with field labelling and value resolution wired in', () => {
    const resolveFieldValue = risks.audit.buildValueResolver(emptyReferenceData());
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { categoryId: null },
            newValues: { categoryId: knownCategoryId },
          },
        ]}
        labels={{ ...risks.audit, resolveFieldValue }}
      />,
    );
    expect(screen.getByText(new RegExp(risks.audit.notRecordedLabel))).toBeInTheDocument();
  });

  it('renders an enum field with the SAME pt-BR label the rest of the interface uses for it — the audit tab and the register never disagree about what a status is called', () => {
    const resolveFieldValue = risks.audit.buildValueResolver(emptyReferenceData());
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { status: 'DRAFT' },
            newValues: { status: 'IDENTIFIED' },
          },
        ]}
        labels={{ ...risks.audit, resolveFieldValue }}
      />,
    );
    expect(screen.getByText('Situação:')).toBeInTheDocument();
    expect(screen.getByText(risks.statusLabels.DRAFT)).toBeInTheDocument();
    expect(screen.getByText(risks.statusLabels.IDENTIFIED)).toBeInTheDocument();
  });

  it('formats a date-only audited field as a calendar date even when the raw audit payload carries a full UTC-midnight ISO instant, never "Invalid Date"', () => {
    const resolveFieldValue = risks.audit.buildValueResolver(emptyReferenceData());
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { nextReviewOn: null },
            newValues: { nextReviewOn: '2026-09-30T00:00:00.000Z' },
          },
        ]}
        labels={{ ...risks.audit, resolveFieldValue }}
      />,
    );
    expect(screen.getByText('Próxima revisão:')).toBeInTheDocument();
    expect(screen.getByText(/30\/09\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders an empty allow-listed array as "Nenhum", never the raw "[]"', () => {
    const resolveFieldValue = risks.audit.buildValueResolver(emptyReferenceData());
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { controlsConsidered: null },
            newValues: { controlsConsidered: [] },
          },
        ]}
        labels={{ ...risks.audit, resolveFieldValue }}
      />,
    );
    expect(screen.getByText('Controles considerados:')).toBeInTheDocument();
    expect(screen.getByText(risks.audit.emptyCollectionLabel)).toBeInTheDocument();
    expect(screen.queryByText('[]')).not.toBeInTheDocument();
  });

  it('joins a multi-element causes/consequences array into one readable pt-BR string, dropping none of the sentences', () => {
    const resolveFieldValue = risks.audit.buildValueResolver(emptyReferenceData());
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { causes: [] },
            newValues: {
              causes: ['Falha humana no processo de aprovacao', 'Ausencia de dupla verificacao'],
            },
          },
        ]}
        labels={{ ...risks.audit, resolveFieldValue }}
      />,
    );
    expect(
      screen.getByText('Falha humana no processo de aprovacao; Ausencia de dupla verificacao'),
    ).toBeInTheDocument();
  });

  it('renders a non-string element of an allow-listed array as a readable JSON fragment, never "[object Object]"', () => {
    const resolveFieldValue = risks.audit.buildValueResolver(emptyReferenceData());
    render(
      <AuditTimeline
        items={[
          {
            ...baseEntry,
            previousValues: { controlsConsidered: [] },
            newValues: { controlsConsidered: [{ id: 'control-1' }] },
          },
        ]}
        labels={{ ...risks.audit, resolveFieldValue }}
      />,
    );
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
    expect(screen.getByText(JSON.stringify({ id: 'control-1' }))).toBeInTheDocument();
  });
});

describe('CommentThread', () => {
  const labels: CommentThreadLabels = {
    caption: 'Comentários de teste',
    loading: 'Carregando comentários…',
    loadError: 'Falha ao carregar os comentários.',
    empty: 'Nenhum comentário ainda.',
    composerLabel: 'Novo comentário (teste)',
    composerPlaceholder: 'Escreva um comentário…',
    submitLabel: 'Comentar',
    submittingLabel: 'Enviando…',
    withdrawLabel: 'Remover',
    loadMoreLabel: 'Carregar mais comentários',
    loadingMoreLabel: 'Carregando mais comentários…',
  };

  const noop = (): void => undefined;

  it('renders comments as a real, navigable list — not a stack of divs', () => {
    const items: CommentThreadItem[] = [
      {
        id: 'comment-1',
        authorName: 'Ana Souza',
        body: 'Primeira observação sobre este risco.',
        createdAtLabel: '05/09/2026 14:32',
      },
    ];
    render(
      <CommentThread
        items={items}
        labels={labels}
        commentValue=""
        onCommentValueChange={noop}
        onSubmit={noop}
      />,
    );
    const list = screen.getByRole('list', { name: labels.caption });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Primeira observação sobre este risco.')).toBeInTheDocument();
  });

  it('renders a comment body as plain text — an injected tag never becomes a real element (stored-XSS defense)', () => {
    const payload = '<img src="x" onerror="window.__pwned = true">';
    const items: CommentThreadItem[] = [
      {
        id: 'comment-1',
        authorName: 'Usuário malicioso',
        body: payload,
        createdAtLabel: '05/09/2026 14:32',
      },
    ];
    render(
      <CommentThread
        items={items}
        labels={labels}
        commentValue=""
        onCommentValueChange={noop}
        onSubmit={noop}
      />,
    );
    expect(screen.getByText(payload)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('hides the composer entirely when the caller cannot comment', () => {
    render(
      <CommentThread
        items={[]}
        labels={labels}
        commentValue=""
        onCommentValueChange={noop}
        onSubmit={noop}
        canComment={false}
      />,
    );
    expect(screen.queryByLabelText(labels.composerLabel)).not.toBeInTheDocument();
  });

  it('submits the caller-controlled composer value and disables submission for a blank/whitespace-only draft', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <CommentThread
        items={[]}
        labels={labels}
        commentValue="   "
        onCommentValueChange={noop}
        onSubmit={onSubmit}
        canComment
      />,
    );
    expect(screen.getByRole('button', { name: labels.submitLabel })).toBeDisabled();

    rerender(
      <CommentThread
        items={[]}
        labels={labels}
        commentValue="Um comentário real"
        onCommentValueChange={noop}
        onSubmit={onSubmit}
        canComment
      />,
    );
    const submitButton = screen.getByRole('button', { name: labels.submitLabel });
    expect(submitButton).toBeEnabled();
    fireEvent.click(submitButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('invokes onWithdraw with the item id only for comments the caller marked withdrawable', () => {
    const onWithdraw = vi.fn();
    const items: CommentThreadItem[] = [
      {
        id: 'comment-1',
        authorName: 'Ana Souza',
        body: 'Comentário próprio.',
        createdAtLabel: '05/09/2026 14:32',
        canWithdraw: true,
      },
      {
        id: 'comment-2',
        authorName: 'Outro usuário',
        body: 'Comentário de outra pessoa.',
        createdAtLabel: '05/09/2026 14:40',
        canWithdraw: false,
      },
    ];
    render(
      <CommentThread
        items={items}
        labels={labels}
        commentValue=""
        onCommentValueChange={noop}
        onSubmit={noop}
        onWithdraw={onWithdraw}
      />,
    );
    expect(screen.getAllByRole('button', { name: labels.withdrawLabel })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: labels.withdrawLabel }));
    expect(onWithdraw).toHaveBeenCalledExactlyOnceWith('comment-1');
  });

  it('shows the loading and error states from caller-supplied props', () => {
    const { rerender } = render(
      <CommentThread
        items={[]}
        labels={labels}
        commentValue=""
        onCommentValueChange={noop}
        onSubmit={noop}
        isLoading
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(labels.loading);

    rerender(
      <CommentThread
        items={[]}
        labels={labels}
        commentValue=""
        onCommentValueChange={noop}
        onSubmit={noop}
        error={{ title: 'Falha de teste', detail: labels.loadError }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falha de teste');
  });

  it('is built entirely from caller-supplied props — holds no hardcoded copy of its own (D-10)', () => {
    const weirdLabels: CommentThreadLabels = {
      caption: 'CAPTION_c7f',
      loading: 'LOADING_c7f',
      loadError: 'LOADERROR_c7f',
      empty: 'EMPTY_c7f',
      composerLabel: 'COMPOSER_c7f',
      composerPlaceholder: 'PLACEHOLDER_c7f',
      submitLabel: 'SUBMIT_c7f',
      submittingLabel: 'SUBMITTING_c7f',
      withdrawLabel: 'WITHDRAW_c7f',
      loadMoreLabel: 'LOADMORE_c7f',
      loadingMoreLabel: 'LOADINGMORE_c7f',
    };

    const { rerender } = render(
      <CommentThread
        items={[]}
        labels={weirdLabels}
        commentValue=""
        onCommentValueChange={noop}
        onSubmit={noop}
        canComment
      />,
    );
    expect(screen.getByText('EMPTY_c7f')).toBeInTheDocument();
    expect(screen.getByText('COMPOSER_c7f')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('PLACEHOLDER_c7f')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SUBMIT_c7f' })).toBeInTheDocument();

    rerender(
      <CommentThread
        items={[
          {
            id: 'c1',
            authorName: 'AUTHOR_c7f',
            body: 'BODY_c7f',
            createdAtLabel: 'CREATED_c7f',
            canWithdraw: true,
          },
        ]}
        labels={weirdLabels}
        commentValue=""
        onCommentValueChange={noop}
        onSubmit={noop}
        onWithdraw={noop}
        hasMore
      />,
    );
    expect(screen.getByRole('list', { name: 'CAPTION_c7f' })).toBeInTheDocument();
    expect(screen.getByText('AUTHOR_c7f')).toBeInTheDocument();
    expect(screen.getByText('BODY_c7f')).toBeInTheDocument();
    expect(screen.getByText('CREATED_c7f')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WITHDRAW_c7f' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOADMORE_c7f' })).toBeInTheDocument();
    expect(screen.queryByText(/carregando|loading|nada por aqui/i)).not.toBeInTheDocument();
  });
});

describe('AttachmentList', () => {
  const noop = (): void => undefined;

  const labels: AttachmentListLabels = {
    caption: 'Anexos de teste',
    loading: 'Carregando anexos…',
    loadError: 'Falha ao carregar os anexos.',
    empty: 'Nenhum anexo ainda.',
    chooseFileLabel: 'Selecionar arquivo (teste)',
    uploadLabel: 'Enviar arquivo',
    uploadingLabel: 'Enviando…',
    allowedTypesHint: 'Formatos aceitos: PDF, PNG, JPEG, texto simples. Tamanho máximo: 25 MB.',
    downloadLabel: 'Baixar',
    withdrawLabel: 'Remover',
    loadMoreLabel: 'Carregar mais anexos',
    loadingMoreLabel: 'Carregando mais anexos…',
  };

  it('renders attachments as a real, navigable list, each linking to its authorizing download path', () => {
    const items: AttachmentListItem[] = [
      {
        id: 'attachment-1',
        fileName: 'evidencia.pdf',
        contentType: 'application/pdf',
        sizeLabel: '1,2 MB',
        uploadedByName: 'Ana Souza',
        uploadedAtLabel: '05/09/2026 14:32',
        contentUrl: '/api/v1/attachments/attachment-1/content',
      },
    ];
    render(<AttachmentList items={items} labels={labels} />);
    const list = screen.getByRole('list', { name: labels.caption });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    const link = screen.getByRole('link', { name: /evidencia\.pdf/ });
    expect(link).toHaveAttribute('href', '/api/v1/attachments/attachment-1/content');
  });

  it('states the allow-listed types and size limit before any file is chosen (US9 AS3)', () => {
    render(<AttachmentList items={[]} labels={labels} canUpload />);
    expect(screen.getByText(labels.allowedTypesHint)).toBeInTheDocument();
  });

  it('hides the upload control entirely when the caller cannot upload', () => {
    render(<AttachmentList items={[]} labels={labels} canUpload={false} />);
    expect(screen.queryByText(labels.allowedTypesHint)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: labels.uploadLabel })).not.toBeInTheDocument();
  });

  it('hands the chosen File to the caller — never uploads it itself', () => {
    const onUpload = vi.fn();
    render(<AttachmentList items={[]} labels={labels} canUpload onUpload={onUpload} />);
    const file = new File(['%PDF-1.4 conteúdo de teste'], 'evidencia.pdf', {
      type: 'application/pdf',
    });
    const input = screen.getByLabelText(labels.chooseFileLabel);
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: labels.uploadLabel }));
    expect(onUpload).toHaveBeenCalledExactlyOnceWith(file);
  });

  it('surfaces the server refusal reason verbatim — never a generic failure message', () => {
    render(
      <AttachmentList
        items={[]}
        labels={{
          ...labels,
          uploadError: 'O tipo de arquivo declarado não corresponde ao conteúdo enviado (teste).',
        }}
        canUpload
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/não corresponde ao conteúdo enviado/);
  });

  it('invokes onWithdraw with the item id only for attachments the caller marked withdrawable', () => {
    const onWithdraw = vi.fn();
    const items: AttachmentListItem[] = [
      {
        id: 'attachment-1',
        fileName: 'evidencia.pdf',
        contentType: 'application/pdf',
        sizeLabel: '1,2 MB',
        uploadedByName: 'Ana Souza',
        uploadedAtLabel: '05/09/2026 14:32',
        contentUrl: '/api/v1/attachments/attachment-1/content',
        canWithdraw: true,
      },
      {
        id: 'attachment-2',
        fileName: 'planilha.txt',
        contentType: 'text/plain',
        sizeLabel: '10 KB',
        uploadedByName: 'Outro usuário',
        uploadedAtLabel: '05/09/2026 15:00',
        contentUrl: '/api/v1/attachments/attachment-2/content',
        canWithdraw: false,
      },
    ];
    render(<AttachmentList items={items} labels={labels} onWithdraw={onWithdraw} />);
    expect(screen.getAllByRole('button', { name: labels.withdrawLabel })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: labels.withdrawLabel }));
    expect(onWithdraw).toHaveBeenCalledExactlyOnceWith('attachment-1');
  });

  it('shows the loading and error states from caller-supplied props', () => {
    const { rerender } = render(<AttachmentList items={[]} labels={labels} isLoading />);
    expect(screen.getByRole('status')).toHaveTextContent(labels.loading);

    rerender(
      <AttachmentList
        items={[]}
        labels={labels}
        error={{ title: 'Falha de teste', detail: labels.loadError }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falha de teste');
  });

  it('is built entirely from caller-supplied props — holds no hardcoded copy of its own (D-10)', () => {
    const weirdLabels: AttachmentListLabels = {
      caption: 'CAPTION_b3e',
      loading: 'LOADING_b3e',
      loadError: 'LOADERROR_b3e',
      empty: 'EMPTY_b3e',
      chooseFileLabel: 'CHOOSEFILE_b3e',
      uploadLabel: 'UPLOAD_b3e',
      uploadingLabel: 'UPLOADING_b3e',
      allowedTypesHint: 'ALLOWEDTYPES_b3e',
      downloadLabel: 'DOWNLOAD_b3e',
      withdrawLabel: 'WITHDRAW_b3e',
      loadMoreLabel: 'LOADMORE_b3e',
      loadingMoreLabel: 'LOADINGMORE_b3e',
    };

    const { rerender } = render(<AttachmentList items={[]} labels={weirdLabels} canUpload />);
    expect(screen.getByText('EMPTY_b3e')).toBeInTheDocument();
    expect(screen.getByText('ALLOWEDTYPES_b3e')).toBeInTheDocument();
    expect(screen.getByLabelText('CHOOSEFILE_b3e')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'UPLOAD_b3e' })).toBeInTheDocument();

    rerender(
      <AttachmentList
        items={[
          {
            id: 'a1',
            fileName: 'FILENAME_b3e',
            contentType: 'CONTENTTYPE_b3e',
            sizeLabel: 'SIZE_b3e',
            uploadedByName: 'UPLOADER_b3e',
            uploadedAtLabel: 'UPLOADEDAT_b3e',
            contentUrl: '/api/v1/attachments/a1/content',
            canWithdraw: true,
          },
        ]}
        labels={weirdLabels}
        onWithdraw={noop}
        hasMore
      />,
    );
    expect(screen.getByRole('list', { name: 'CAPTION_b3e' })).toBeInTheDocument();
    expect(screen.getByText('FILENAME_b3e')).toBeInTheDocument();
    expect(screen.getByText(/UPLOADER_b3e/)).toHaveTextContent(
      'UPLOADER_b3e · UPLOADEDAT_b3e · SIZE_b3e · CONTENTTYPE_b3e',
    );
    expect(screen.getByRole('button', { name: 'WITHDRAW_b3e' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'LOADMORE_b3e' })).toBeInTheDocument();
    expect(screen.queryByText(/carregando|loading|nada por aqui/i)).not.toBeInTheDocument();
  });
});

describe('SearchablePicker', () => {
  const noop = (): void => undefined;
  const labels = {
    placeholder: 'PLACEHOLDER_sp1',
    searchPlaceholder: 'SEARCHPLACEHOLDER_sp1',
    emptyText: 'EMPTY_sp1',
    loadingText: 'LOADING_sp1',
    partialResultsText: (n: number): string => `PARTIAL_sp1_${String(n)}`,
    triggerAriaLabel: 'TRIGGERARIA_sp1',
  };

  it('gives an option with a label and a description one legible accessible name, never the two fused', async () => {
    render(
      <SearchablePicker
        value={undefined}
        onChange={noop}
        onSearch={() =>
          Promise.resolve({
            options: [
              { id: 'opt-1', label: 'Controle fora do escopo', description: 'CTL-2026-0001' },
            ],
            isPartial: false,
          })
        }
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'TRIGGERARIA_sp1' }));
    const option = await screen.findByRole('option', { name: /Controle fora do escopo/ });

    expect(option).toHaveAccessibleName('Controle fora do escopo CTL-2026-0001');
    expect(screen.getByText('Controle fora do escopo')).toBeInTheDocument();
    expect(screen.getByText('CTL-2026-0001')).toBeInTheDocument();
  });

  it('gives an option with no description an accessible name equal to its plain label', async () => {
    render(
      <SearchablePicker
        value={undefined}
        onChange={noop}
        onSearch={() =>
          Promise.resolve({ options: [{ id: 'opt-2', label: 'Sem descrição' }], isPartial: false })
        }
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'TRIGGERARIA_sp1' }));
    const option = await screen.findByRole('option', { name: 'Sem descrição' });
    expect(option).toHaveAccessibleName('Sem descrição');
  });
});

describe('DetailPanel', () => {
  it('renders the caller header, body and footer, and nothing of its own', () => {
    render(
      <DetailPanel
        ariaLabel="PANELREGION_dp1"
        header={<h2>PANELHEADER_dp1</h2>}
        footer={<button type="button">PANELFOOTER_dp1</button>}
      >
        <p>PANELBODY_dp1</p>
      </DetailPanel>,
    );

    const region = screen.getByRole('complementary', { name: 'PANELREGION_dp1' });
    expect(within(region).getByText('PANELHEADER_dp1')).toBeInTheDocument();
    expect(within(region).getByText('PANELBODY_dp1')).toBeInTheDocument();
    expect(within(region).getByText('PANELFOOTER_dp1')).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: /fechar/i })).not.toBeInTheDocument();
  });

  it('omits the footer bar entirely when the caller passes none', () => {
    const { container } = render(
      <DetailPanel ariaLabel="PANELREGION_dp2" header={<h2>PANELHEADER_dp2</h2>}>
        <p>PANELBODY_dp2</p>
      </DetailPanel>,
    );

    expect(container.querySelector('[data-slot="detail-panel-footer"]')).toBeNull();
  });

  it('scrolls the body only — the header and footer are fixed', () => {
    const { container } = render(
      <DetailPanel
        ariaLabel="PANELREGION_dp3"
        header={<h2>PANELHEADER_dp3</h2>}
        footer={<button type="button">PANELFOOTER_dp3</button>}
      >
        <p>PANELBODY_dp3</p>
      </DetailPanel>,
    );

    const body = container.querySelector('[data-slot="detail-panel-body"]');
    const header = container.querySelector('[data-slot="detail-panel-header"]');
    const footer = container.querySelector('[data-slot="detail-panel-footer"]');

    expect(body?.className).toContain('overflow-y-auto');
    expect(body?.className).toContain('min-h-0');
    expect(header?.className).toContain('shrink-0');
    expect(footer?.className).toContain('shrink-0');
    expect(header?.className).not.toContain('overflow-y-auto');
  });

  it('names its close control from the caller, and calls back when it is pressed', () => {
    const onClose = vi.fn();
    render(
      <DetailPanel
        ariaLabel="PANELREGION_dp4"
        header={<h2>PANELHEADER_dp4</h2>}
        onClose={onClose}
        closeLabel="PANELCLOSE_dp4"
      >
        <p>PANELBODY_dp4</p>
      </DetailPanel>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'PANELCLOSE_dp4' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape in inline mode, where nothing else would', () => {
    const onClose = vi.fn();
    render(
      <DetailPanel
        ariaLabel="PANELREGION_dp5"
        header={<h2>PANELHEADER_dp5</h2>}
        onClose={onClose}
        closeLabel="PANELCLOSE_dp5"
      >
        <p>PANELBODY_dp5</p>
      </DetailPanel>,
    );

    fireEvent.keyDown(screen.getByRole('complementary', { name: 'PANELREGION_dp5' }), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape to the modal container in overlay mode, so one keypress does not close two things', () => {
    const onClose = vi.fn();
    render(
      <DetailPanel
        ariaLabel="PANELREGION_dp6"
        mode="overlay"
        header={<h2>PANELHEADER_dp6</h2>}
        onClose={onClose}
        closeLabel="PANELCLOSE_dp6"
      >
        <p>PANELBODY_dp6</p>
      </DetailPanel>,
    );

    fireEvent.keyDown(screen.getByRole('complementary', { name: 'PANELREGION_dp6' }), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the panel when it opens inline, and hands it back to the opener when it closes', () => {
    function Harness(): React.JSX.Element {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            PANELOPENER_dp7
          </button>
          {open ? (
            <DetailPanel
              ariaLabel="PANELREGION_dp7"
              header={<h2>PANELHEADER_dp7</h2>}
              onClose={() => setOpen(false)}
              closeLabel="PANELCLOSE_dp7"
            >
              <p>PANELBODY_dp7</p>
            </DetailPanel>
          ) : null}
        </div>
      );
    }
    render(<Harness />);

    const opener = screen.getByRole('button', { name: 'PANELOPENER_dp7' });
    opener.focus();
    fireEvent.click(opener);

    const region = screen.getByRole('complementary', { name: 'PANELREGION_dp7' });
    expect(document.activeElement).toBe(region);

    fireEvent.click(screen.getByRole('button', { name: 'PANELCLOSE_dp7' }));
    expect(
      screen.queryByRole('complementary', { name: 'PANELREGION_dp7' }),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });

  it('does not touch focus in overlay mode, where the modal container owns it', () => {
    function Harness(): React.JSX.Element {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            PANELOPENER_dp8
          </button>
          {open ? (
            <DetailPanel
              ariaLabel="PANELREGION_dp8"
              mode="overlay"
              header={<h2>PANELHEADER_dp8</h2>}
            >
              <p>PANELBODY_dp8</p>
            </DetailPanel>
          ) : null}
        </div>
      );
    }
    render(<Harness />);

    const opener = screen.getByRole('button', { name: 'PANELOPENER_dp8' });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole('complementary', { name: 'PANELREGION_dp8' })).toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
  });
});

describe('DisclosureGroup', () => {
  it('starts collapsed, with the content absent rather than merely hidden', () => {
    render(
      <DisclosureGroup title="GROUPTITLE_dg1">
        <p>GROUPBODY_dg1</p>
      </DisclosureGroup>,
    );

    const toggle = screen.getByRole('button', { name: /GROUPTITLE_dg1/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('GROUPBODY_dg1')).not.toBeInTheDocument();
  });

  it('expands on activation and names the revealed region with the toggle that revealed it', () => {
    render(
      <DisclosureGroup title="GROUPTITLE_dg2">
        <p>GROUPBODY_dg2</p>
      </DisclosureGroup>,
    );

    const toggle = screen.getByRole('button', { name: /GROUPTITLE_dg2/ });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const region = screen.getByRole('region', { name: /GROUPTITLE_dg2/ });
    expect(within(region).getByText('GROUPBODY_dg2')).toBeInTheDocument();
    expect(toggle.getAttribute('aria-controls')).toBe(region.getAttribute('id'));
  });

  it("folds trailing meta into the toggle's own accessible name, so a count is announced with its group", () => {
    render(
      <DisclosureGroup title="GROUPTITLE_dg3" meta={<span>GROUPCOUNT_dg3</span>}>
        <p>GROUPBODY_dg3</p>
      </DisclosureGroup>,
    );

    expect(
      screen.getByRole('button', { name: 'GROUPTITLE_dg3 GROUPCOUNT_dg3' }),
    ).toBeInTheDocument();
  });

  it('lets a parent drive it, which is what "expand every group at once" needs', () => {
    function Harness(): React.JSX.Element {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            GROUPEXPANDALL_dg4
          </button>
          <DisclosureGroup title="GROUPTITLE_dg4" open={open} onOpenChange={setOpen}>
            <p>GROUPBODY_dg4</p>
          </DisclosureGroup>
        </div>
      );
    }
    render(<Harness />);

    expect(screen.queryByText('GROUPBODY_dg4')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'GROUPEXPANDALL_dg4' }));
    expect(screen.getByText('GROUPBODY_dg4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GROUPTITLE_dg4/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('reports every toggle to a controlling parent, including the closing one', () => {
    const onOpenChange = vi.fn();
    render(
      <DisclosureGroup title="GROUPTITLE_dg5" open onOpenChange={onOpenChange}>
        <p>GROUPBODY_dg5</p>
      </DisclosureGroup>,
    );

    fireEvent.click(screen.getByRole('button', { name: /GROUPTITLE_dg5/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('honours defaultOpen when nobody is controlling it', () => {
    render(
      <DisclosureGroup title="GROUPTITLE_dg6" defaultOpen>
        <p>GROUPBODY_dg6</p>
      </DisclosureGroup>,
    );

    expect(screen.getByText('GROUPBODY_dg6')).toBeInTheDocument();
  });

  it('puts the toggle inside a heading only when the caller places it in a document outline', () => {
    const { rerender } = render(
      <DisclosureGroup title="GROUPTITLE_dg7">
        <p>GROUPBODY_dg7</p>
      </DisclosureGroup>,
    );
    expect(screen.queryByRole('heading', { name: /GROUPTITLE_dg7/ })).not.toBeInTheDocument();

    rerender(
      <DisclosureGroup title="GROUPTITLE_dg7" headingLevel={3}>
        <p>GROUPBODY_dg7</p>
      </DisclosureGroup>,
    );
    expect(screen.getByRole('heading', { level: 3, name: /GROUPTITLE_dg7/ })).toBeInTheDocument();
  });

  it('is reachable and operable by keyboard as a native button', () => {
    render(
      <DisclosureGroup title="GROUPTITLE_dg8">
        <p>GROUPBODY_dg8</p>
      </DisclosureGroup>,
    );

    const toggle = screen.getByRole('button', { name: /GROUPTITLE_dg8/ });
    toggle.focus();
    expect(document.activeElement).toBe(toggle);
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle).toHaveAttribute('type', 'button');
  });
});
