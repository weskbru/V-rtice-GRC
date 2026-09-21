import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IndicatorDistributionCard } from './indicator-distribution-card';

import type { IndicatorBucket } from '../indicator-overview-model';

const BUCKETS: readonly IndicatorBucket[] = [
  { key: 'LOW', count: 117 },
  { key: 'MEDIUM', count: 2 },
  { key: 'HIGH', count: 0 },
  { key: 'CRITICAL', count: 57 },
];

describe('IndicatorDistributionCard', () => {
  it('renders the domain caption, name link, and the total with its own caption', () => {
    render(
      <IndicatorDistributionCard
        domain="RISK"
        name="Riscos por nível"
        detailHref="/indicators/RISK_TOTAL_BY_LEVEL"
        total={176}
        buckets={BUCKETS}
      />,
    );

    expect(screen.getByText('Riscos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Riscos por nível' })).toHaveAttribute(
      'href',
      '/indicators/RISK_TOTAL_BY_LEVEL',
    );
    expect(screen.getByText('176')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('renders one badge and one number per bucket, including a genuine zero', () => {
    render(
      <IndicatorDistributionCard
        domain="RISK"
        name="Riscos por nível"
        detailHref="/indicators/RISK_TOTAL_BY_LEVEL"
        total={176}
        buckets={BUCKETS}
      />,
    );

    expect(screen.getByText('117')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('57')).toBeInTheDocument();
    expect(screen.getByText('Baixo')).toBeInTheDocument();
    expect(screen.getByText('Médio')).toBeInTheDocument();
    expect(screen.getByText('Alto')).toBeInTheDocument();
    expect(screen.getByText('Crítico')).toBeInTheDocument();
  });

  it('renders a bucket count as plain text when no href is supplied', () => {
    render(
      <IndicatorDistributionCard
        domain="RISK"
        name="Riscos por nível"
        detailHref="/indicators/RISK_TOTAL_BY_LEVEL"
        total={176}
        buckets={BUCKETS}
      />,
    );

    expect(screen.queryByRole('link', { name: /ver registros/i })).not.toBeInTheDocument();
  });

  it('renders a bucket count as a link, with the risk "nível" accessible-name wording, even at zero', () => {
    const bucketsWithLinks: readonly IndicatorBucket[] = [
      { key: 'LOW', count: 117, href: '/risks?riskLevel=LOW' },
      { key: 'MEDIUM', count: 2, href: '/risks?riskLevel=MEDIUM' },
      { key: 'HIGH', count: 0, href: '/risks?riskLevel=HIGH' },
      { key: 'CRITICAL', count: 57, href: '/risks?riskLevel=CRITICAL' },
    ];

    render(
      <IndicatorDistributionCard
        domain="RISK"
        name="Riscos por nível"
        detailHref="/indicators/RISK_TOTAL_BY_LEVEL"
        total={176}
        buckets={bucketsWithLinks}
      />,
    );

    expect(
      screen.getByRole('link', { name: '0 riscos de nível Alto — ver registros' }),
    ).toHaveAttribute('href', '/risks?riskLevel=HIGH');
    expect(
      screen.getByRole('link', { name: '57 riscos de nível Crítico — ver registros' }),
    ).toHaveAttribute('href', '/risks?riskLevel=CRITICAL');
  });

  it('uses the feminine "severidade" wording (not the risk "nível" form) for a non-risk domain', () => {
    const bucketsWithLinks: readonly IndicatorBucket[] = [
      { key: 'LOW', count: 3, href: '/incidents?severity=LOW' },
      { key: 'MEDIUM', count: 1, href: '/incidents?severity=MEDIUM' },
      { key: 'HIGH', count: 213, href: '/incidents?severity=HIGH' },
      { key: 'CRITICAL', count: 0, href: '/incidents?severity=CRITICAL' },
    ];

    render(
      <IndicatorDistributionCard
        domain="INCIDENT"
        name="Incidentes abertos por severidade"
        detailHref="/indicators/INCIDENT_OPEN_COUNT_BY_SEVERITY"
        total={217}
        buckets={bucketsWithLinks}
      />,
    );

    expect(
      screen.getByRole('link', { name: '213 incidentes de severidade Alta — ver registros' }),
    ).toHaveAttribute('href', '/incidents?severity=HIGH');
  });

  it('renders "Ver registros →" only when recordsHref is supplied', () => {
    const { rerender } = render(
      <IndicatorDistributionCard
        domain="INCIDENT"
        name="Incidentes abertos por severidade"
        detailHref="/indicators/INCIDENT_OPEN_COUNT_BY_SEVERITY"
        total={217}
        buckets={BUCKETS}
      />,
    );
    expect(screen.queryByText('Ver registros')).not.toBeInTheDocument();

    rerender(
      <IndicatorDistributionCard
        domain="INCIDENT"
        name="Incidentes abertos por severidade"
        detailHref="/indicators/INCIDENT_OPEN_COUNT_BY_SEVERITY"
        total={217}
        buckets={BUCKETS}
        recordsHref="/incidents?status=OPEN,IN_PROGRESS,RESOLVED"
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Ver registros de Incidentes abertos por severidade' }),
    ).toHaveAttribute('href', '/incidents?status=OPEN,IN_PROGRESS,RESOLVED');
  });

  it('hides the decorative distribution bar from assistive technology', () => {
    const { container } = render(
      <IndicatorDistributionCard
        domain="RISK"
        name="Riscos por nível"
        detailHref="/indicators/RISK_TOTAL_BY_LEVEL"
        total={176}
        buckets={BUCKETS}
      />,
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
