import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IndicatorSingleValueCard } from './indicator-single-value-card';

describe('IndicatorSingleValueCard', () => {
  it('renders the domain caption, name link, and a plain count value', () => {
    render(
      <IndicatorSingleValueCard
        domain="CONTROL"
        name="Controles inativos"
        detailHref="/indicators/CONTROL_INACTIVE_COUNT"
        reading={{ kind: 'single', value: 61, unit: 'count' }}
      />,
    );

    expect(screen.getByText('Controles')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Controles inativos' })).toHaveAttribute(
      'href',
      '/indicators/CONTROL_INACTIVE_COUNT',
    );
    expect(screen.getByText('61')).toBeInTheDocument();
  });

  it('formats a percentage value with one decimal place and a trailing %', () => {
    render(
      <IndicatorSingleValueCard
        domain="COMPLIANCE"
        name="Percentual de conformidade"
        detailHref="/indicators/COMPLIANCE_PERCENTAGE"
        reading={{ kind: 'single', value: 0, unit: 'percent' }}
      />,
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders a real zero as "0", never as unavailable text', () => {
    render(
      <IndicatorSingleValueCard
        domain="ASSET"
        name="Ativos inativos"
        detailHref="/indicators/ASSET_INACTIVE_COUNT"
        reading={{ kind: 'single', value: 0, unit: 'count' }}
      />,
    );

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('Sem dados calculados')).not.toBeInTheDocument();
  });

  it('renders "Sem dados calculados" instead of a zero when the source has no data yet', () => {
    render(
      <IndicatorSingleValueCard
        domain="COMPLIANCE"
        name="Percentual de conformidade"
        detailHref="/indicators/COMPLIANCE_PERCENTAGE"
        reading={{ kind: 'no-data' }}
      />,
    );

    expect(screen.getByText('Sem dados calculados')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('renders the threshold line only when a threshold is supplied, with the comparator as a symbol', () => {
    const { rerender } = render(
      <IndicatorSingleValueCard
        domain="ACTION"
        name="Ações em atraso"
        detailHref="/indicators/ACTION_OVERDUE_COUNT"
        reading={{ kind: 'single', value: 92, unit: 'count' }}
      />,
    );
    expect(screen.queryByText(/Limite:/)).not.toBeInTheDocument();

    rerender(
      <IndicatorSingleValueCard
        domain="ACTION"
        name="Ações em atraso"
        detailHref="/indicators/ACTION_OVERDUE_COUNT"
        reading={{ kind: 'single', value: 92, unit: 'count' }}
        threshold={{ comparator: 'GTE', value: 50 }}
      />,
    );
    expect(screen.getByText('Limite: ≥ 50')).toBeInTheDocument();
  });

  it('renders the definition description only when supplied', () => {
    render(
      <IndicatorSingleValueCard
        domain="ACTION"
        name="Ações em atraso"
        detailHref="/indicators/ACTION_OVERDUE_COUNT"
        reading={{ kind: 'single', value: 92, unit: 'count' }}
        definitionDescription="Ações vencidas atribuídas a qualquer origem."
      />,
    );
    expect(screen.getByText('Ações vencidas atribuídas a qualquer origem.')).toBeInTheDocument();
  });

  it('renders the scope note only when supplied (the ORGANIZATION_WIDE exception under a unit-scoped caller)', () => {
    const { rerender } = render(
      <IndicatorSingleValueCard
        domain="COMPLIANCE"
        name="Percentual de conformidade"
        detailHref="/indicators/COMPLIANCE_PERCENTAGE"
        reading={{ kind: 'single', value: 0, unit: 'percent' }}
      />,
    );
    expect(
      screen.queryByText('Este indicador é sempre calculado para a organização inteira.'),
    ).not.toBeInTheDocument();

    rerender(
      <IndicatorSingleValueCard
        domain="COMPLIANCE"
        name="Percentual de conformidade"
        detailHref="/indicators/COMPLIANCE_PERCENTAGE"
        reading={{ kind: 'single', value: 0, unit: 'percent' }}
        scopeNote="Este indicador é sempre calculado para a organização inteira."
      />,
    );
    expect(
      screen.getByText('Este indicador é sempre calculado para a organização inteira.'),
    ).toBeInTheDocument();
  });

  it('renders "Ver registros" only when recordsHref is supplied, with a fully-named accessible label', () => {
    const { rerender } = render(
      <IndicatorSingleValueCard
        domain="ASSET"
        name="Ativos inativos"
        detailHref="/indicators/ASSET_INACTIVE_COUNT"
        reading={{ kind: 'single', value: 2, unit: 'count' }}
      />,
    );
    expect(screen.queryByText('Ver registros')).not.toBeInTheDocument();

    rerender(
      <IndicatorSingleValueCard
        domain="ASSET"
        name="Ativos inativos"
        detailHref="/indicators/ASSET_INACTIVE_COUNT"
        reading={{ kind: 'single', value: 2, unit: 'count' }}
        recordsHref="/assets?isActive=false"
      />,
    );
    expect(screen.getByRole('link', { name: 'Ver registros de Ativos inativos' })).toHaveAttribute(
      'href',
      '/assets?isActive=false',
    );
  });
});
