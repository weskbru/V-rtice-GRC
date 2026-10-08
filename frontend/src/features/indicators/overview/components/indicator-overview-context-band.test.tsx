import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IndicatorOverviewContextBand } from './indicator-overview-context-band';

const FETCHED_AT = new Date('2026-09-15T14:32:00.000Z');

describe('IndicatorOverviewContextBand', () => {
  it('states the full count, the caller scope and a single shared timestamp when every key is available', () => {
    render(
      <IndicatorOverviewContextBand
        totalCount={11}
        availableCount={11}
        scopeGlobal
        fetchedAt={FETCHED_AT}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText('11 indicadores')).toBeInTheDocument();
    expect(screen.getByText('Escopo: Organização inteira')).toBeInTheDocument();
    expect(screen.getByText(/^Calculados às/)).toBeInTheDocument();
  });

  it('states how many keys are available and why the rest are missing, never silently dropping them', () => {
    render(
      <IndicatorOverviewContextBand
        totalCount={11}
        availableCount={9}
        scopeGlobal={false}
        fetchedAt={FETCHED_AT}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByText('9 de 11 disponíveis — 2 exigem permissão do módulo de origem'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escopo: Unidades organizacionais do seu escopo')).toBeInTheDocument();
  });

  it('uses singular wording for exactly one missing key', () => {
    render(
      <IndicatorOverviewContextBand
        totalCount={11}
        availableCount={10}
        scopeGlobal
        fetchedAt={FETCHED_AT}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByText('10 de 11 disponíveis — 1 exige permissão do módulo de origem'),
    ).toBeInTheDocument();
  });

  it('omits the monitoring line entirely when the breakdown block is absent — never a fabricated zero', () => {
    render(
      <IndicatorOverviewContextBand
        totalCount={11}
        availableCount={11}
        scopeGlobal
        fetchedAt={FETCHED_AT}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.queryByText(/com limite/)).not.toBeInTheDocument();
  });

  it('explains zero monitored indicators distinctly from a real monitoring summary', () => {
    render(
      <IndicatorOverviewContextBand
        totalCount={11}
        availableCount={11}
        scopeGlobal
        fetchedAt={FETCHED_AT}
        monitoring={{ monitored: 0, breached: 0 }}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText('Nenhum indicador com limite configurado')).toBeInTheDocument();
  });

  it('renders the monitoring summary line when at least one indicator is monitored', () => {
    render(
      <IndicatorOverviewContextBand
        totalCount={11}
        availableCount={11}
        scopeGlobal
        fetchedAt={FETCHED_AT}
        monitoring={{ monitored: 3, breached: 1 }}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByText('3 com limite configurado · 1 com limite rompido na última medição'),
    ).toBeInTheDocument();
  });

  it('calls onRefresh when the button is activated, and disables it while refreshing', () => {
    const onRefresh = vi.fn();
    const { rerender } = render(
      <IndicatorOverviewContextBand
        totalCount={11}
        availableCount={11}
        scopeGlobal
        fetchedAt={FETCHED_AT}
        isRefreshing={false}
        onRefresh={onRefresh}
      />,
    );

    screen.getByRole('button', { name: 'Atualizar' }).click();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <IndicatorOverviewContextBand
        totalCount={11}
        availableCount={11}
        scopeGlobal
        fetchedAt={FETCHED_AT}
        isRefreshing
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Atualizando indicadores…');
  });
});
