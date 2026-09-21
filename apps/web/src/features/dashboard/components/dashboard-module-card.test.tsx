import { render, screen, within } from '@testing-library/react';
import { Siren } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { DashboardModuleCard } from './dashboard-module-card';

import type { DashboardModuleMetric } from './dashboard-module-card';

function renderCard(metrics: readonly DashboardModuleMetric[]) {
  return render(
    <DashboardModuleCard
      title="Incidentes"
      icon={Siren}
      tone="red"
      metrics={metrics}
      link={{ path: '/incidents', label: 'Acessar incidentes' }}
    />,
  );
}

/** The `<dd>` a label names — read through the description-list pairing, not by position. */
function valueFor(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: 'dt' });
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement)) {
    throw new Error(`No value for "${label}"`);
  }
  return value;
}

describe('DashboardModuleCard', () => {
  it('renders each metric as a labelled term/value pair, plus the area link', () => {
    renderCard([
      { label: 'Abertos', value: 12 },
      { label: 'Críticos', value: 3, tone: 'danger' },
    ]);

    expect(screen.getByRole('heading', { name: 'Incidentes' })).toBeInTheDocument();
    expect(valueFor('Abertos')).toHaveTextContent('12');
    expect(valueFor('Críticos')).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: 'Acessar incidentes' })).toHaveAttribute(
      'href',
      '/incidents',
    );
  });

  /**
   * A metric's tone says what its number MEANS above zero. "0 críticos" is
   * not a danger, so the reserved status colour must not be spent on it.
   */
  it('applies a metric tone only when the figure is above zero', () => {
    renderCard([
      { label: 'Críticos', value: 3, tone: 'danger' },
      { label: 'Inefetivos', value: 0, tone: 'warning' },
    ]);

    expect(valueFor('Críticos').className).toContain('text-status-danger-fg');
    expect(valueFor('Inefetivos').className).toContain('text-foreground');
    expect(valueFor('Inefetivos').className).not.toContain('text-status-warning-fg');
  });

  it('renders a metric with no data as an em dash, never zero', () => {
    renderCard([{ label: 'Conformidade', value: undefined, unit: 'percent' }]);

    expect(valueFor('Conformidade')).toHaveTextContent('—');
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('renders a percentage metric with its unit', () => {
    renderCard([{ label: 'Conformidade', value: 62.4, unit: 'percent' }]);

    expect(valueFor('Conformidade')).toHaveTextContent('62,4%');
  });

  it('renders exactly the metrics it is given, and carries its area tint', () => {
    const { container } = renderCard([{ label: 'Abertos', value: 4 }]);

    expect(within(container).getAllByRole('term')).toHaveLength(1);
    expect(container.querySelector('[data-tone="red"]')).not.toBeNull();
  });
});
