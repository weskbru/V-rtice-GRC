import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IndicatorOverviewLoading } from './indicator-overview-loading';

describe('IndicatorOverviewLoading', () => {
  it('announces loading through a single status region, not one per card', () => {
    render(<IndicatorOverviewLoading />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando indicadores…');
  });
});
