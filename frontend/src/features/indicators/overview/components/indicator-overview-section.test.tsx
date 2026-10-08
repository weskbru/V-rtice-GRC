import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IndicatorOverviewSection } from './indicator-overview-section';

describe('IndicatorOverviewSection', () => {
  it('renders a labelled landmark section whose accessible name comes from its own visible heading', () => {
    render(
      <IndicatorOverviewSection title="Composição por nível e severidade" variant="wide">
        <p>conteúdo</p>
      </IndicatorOverviewSection>,
    );

    const region = screen.getByRole('region', { name: 'Composição por nível e severidade' });
    expect(region).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Composição por nível e severidade' }),
    ).toBeInTheDocument();
    expect(region).toContainElement(screen.getByText('conteúdo'));
  });

  it('renders its children', () => {
    render(
      <IndicatorOverviewSection title="Contagens e percentuais" variant="compact">
        <p>card 1</p>
        <p>card 2</p>
      </IndicatorOverviewSection>,
    );

    expect(screen.getByText('card 1')).toBeInTheDocument();
    expect(screen.getByText('card 2')).toBeInTheDocument();
  });
});
