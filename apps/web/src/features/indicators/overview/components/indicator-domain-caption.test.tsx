import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IndicatorDomainCaption } from './indicator-domain-caption';

import type { IndicatorDomain } from '../indicator-overview-model';

describe('IndicatorDomainCaption', () => {
  it.each<[IndicatorDomain, string]>([
    ['RISK', 'Riscos'],
    ['ACTION', 'Planos de Ação'],
    ['COMPLIANCE', 'Compliance'],
    ['FINDING', 'Achados'],
  ])('renders the pt-BR domain label for %s', (domain, label) => {
    render(<IndicatorDomainCaption domain={domain} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('hides its icon from assistive technology (the text label alone carries the meaning)', () => {
    const { container } = render(<IndicatorDomainCaption domain="RISK" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
