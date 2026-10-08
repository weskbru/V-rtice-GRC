import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IndicatorUnavailableItemCard } from './indicator-unavailable-item-card';

describe('IndicatorUnavailableItemCard', () => {
  it('renders "Requer permissão de <módulo>" for a no-permission reason, never a zero', () => {
    render(
      <IndicatorUnavailableItemCard
        domain="COMPLIANCE"
        name="Percentual de conformidade"
        detailHref="/indicators/COMPLIANCE_PERCENTAGE"
        reason="no-permission"
        variant="compact"
      />,
    );

    expect(screen.getByText('Requer permissão de Compliance')).toBeInTheDocument();
    expect(
      screen.getByText('Você não tem a permissão do domínio de origem para ver este indicador.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders "Sem dados calculados" for a no-data reason, with no permission hint', () => {
    render(
      <IndicatorUnavailableItemCard
        domain="FINDING"
        name="Achados abertos por severidade"
        detailHref="/indicators/FINDING_OPEN_COUNT_BY_SEVERITY"
        reason="no-data"
        variant="wide"
      />,
    );

    expect(screen.getByText('Sem dados calculados')).toBeInTheDocument();
    expect(
      screen.queryByText('Você não tem a permissão do domínio de origem para ver este indicador.'),
    ).not.toBeInTheDocument();
  });

  it('still links to the detail page even when the value itself is unavailable', () => {
    render(
      <IndicatorUnavailableItemCard
        domain="COMPLIANCE"
        name="Percentual de conformidade"
        detailHref="/indicators/COMPLIANCE_PERCENTAGE"
        reason="no-permission"
        variant="compact"
      />,
    );

    expect(screen.getByRole('link', { name: 'Percentual de conformidade' })).toHaveAttribute(
      'href',
      '/indicators/COMPLIANCE_PERCENTAGE',
    );
  });
});
