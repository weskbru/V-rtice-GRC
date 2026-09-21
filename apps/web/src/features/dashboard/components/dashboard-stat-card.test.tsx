import { render, screen } from '@testing-library/react';
import { TriangleAlert } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { DashboardStatCard } from './dashboard-stat-card';

/**
 * Component-mount evidence for the "o que requer atenção agora" widgets.
 *
 * The assertions that matter are the ones a list tile could not make: that a
 * zero is visibly quieter than a figure that needs action (and not by colour
 * alone — the chip state is asserted as data, the number as text), that "no
 * data" never renders as "0", and that there is no link where the platform
 * has no destination to offer.
 */
function renderCard(props: Partial<Parameters<typeof DashboardStatCard>[0]> = {}) {
  return render(
    <DashboardStatCard
      title="Ações atrasadas"
      icon={TriangleAlert}
      contextTone="red"
      value={47}
      contextLabel="fora do prazo"
      {...props}
    />,
  );
}

describe('DashboardStatCard', () => {
  it('shows the title, the figure and the words that give it meaning', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Ações atrasadas' })).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('fora do prazo')).toBeInTheDocument();
  });

  it('formats the figure in pt-BR', () => {
    renderCard({ value: 1850 });

    expect(screen.getByText('1.850')).toBeInTheDocument();
  });

  it('keeps its severity tint while the figure needs attention', () => {
    const { container } = renderCard({ value: 3 });

    expect(container.querySelector('[data-attention="active"]')).not.toBeNull();
    expect(container.querySelector('[data-tone="red"]')).not.toBeNull();
  });

  /**
   * "0 ações atrasadas" is good news. The card mutes its chip so the cards
   * that DO need action are the ones still in colour — and the number 0
   * beside it says the same thing in words.
   */
  it('mutes a card whose figure is zero', () => {
    const { container } = renderCard({ value: 0 });

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(container.querySelector('[data-attention="idle"]')).not.toBeNull();
    expect(container.querySelector('[data-tone="idle"]')).not.toBeNull();
    expect(container.querySelector('[data-tone="red"]')).toBeNull();
  });

  it('renders a source with no data as an em dash, never as zero', () => {
    renderCard({ value: undefined, contextLabel: 'não deve aparecer' });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('não deve aparecer')).not.toBeInTheDocument();
  });

  it('offers the way in when there is a destination, and nothing when there is not', () => {
    const { rerender } = renderCard({ link: { path: '/actions', label: 'Ver planos de ação' } });

    expect(screen.getByRole('link', { name: 'Ver planos de ação' })).toHaveAttribute(
      'href',
      '/actions',
    );

    // Pending approvals genuinely has no register query that reproduces it,
    // so its card must render without a link rather than with a broken one.
    rerender(
      <DashboardStatCard
        title="Aprovações pendentes"
        icon={TriangleAlert}
        contextTone="amber"
        value={28}
        contextLabel="aguardando sua decisão"
      />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
