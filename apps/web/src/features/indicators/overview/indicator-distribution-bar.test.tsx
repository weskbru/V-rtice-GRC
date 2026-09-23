import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IndicatorDistributionBar } from './indicator-distribution-bar';

import type { IndicatorDistributionSegment } from './indicator-distribution-bar';

const SEGMENTS: readonly IndicatorDistributionSegment[] = [
  { key: 'LOW', count: 117, label: 'Baixo', tone: 'LOW' },
  { key: 'MEDIUM', count: 2, label: 'Médio', tone: 'MEDIUM' },
  { key: 'HIGH', count: 0, label: 'Alto', tone: 'HIGH' },
  { key: 'CRITICAL', count: 57, label: 'Crítico', tone: 'CRITICAL' },
];

describe('IndicatorDistributionBar', () => {
  it('is aria-hidden and never carries role="img"', () => {
    const { container } = render(<IndicatorDistributionBar segments={SEGMENTS} />);
    const track = container.firstElementChild as HTMLElement;

    expect(track.getAttribute('aria-hidden')).toBe('true');
    expect(track.getAttribute('role')).not.toBe('img');
  });

  it('renders one segment per non-zero count, skipping zero-count segments entirely', () => {
    const { container } = render(<IndicatorDistributionBar segments={SEGMENTS} />);
    const track = container.firstElementChild as HTMLElement;

    expect(track.children).toHaveLength(3);
    expect(
      Array.from(track.children).some((el) => el.getAttribute('title')?.startsWith('Alto')),
    ).toBe(false);
  });

  it('sizes each segment proportionally to the total, summing to 100%', () => {
    const { container } = render(<IndicatorDistributionBar segments={SEGMENTS} />);
    const track = container.firstElementChild as HTMLElement;

    const widths = Array.from(track.children).map((el) =>
      parseFloat((el as HTMLElement).style.width),
    );
    const total = widths.reduce((sum, width) => sum + width, 0);

    expect(total).toBeCloseTo(100, 5);
  });

  it("colours each segment with its tone's established risk-level chart token", () => {
    const { container } = render(<IndicatorDistributionBar segments={SEGMENTS} />);
    const track = container.firstElementChild as HTMLElement;
    const low = Array.from(track.children).find((el) =>
      el.getAttribute('title')?.startsWith('Baixo'),
    );

    expect((low as HTMLElement).style.backgroundColor).toBe('var(--risk-low-solid-bg)');
  });

  it('renders an empty neutral track (no children) when every segment is zero', () => {
    const zeroed = SEGMENTS.map((segment) => ({ ...segment, count: 0 }));
    const { container } = render(<IndicatorDistributionBar segments={zeroed} />);
    const track = container.firstElementChild as HTMLElement;

    expect(track.children).toHaveLength(0);
    expect(track.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders an empty neutral track when segments is an empty array', () => {
    const { container } = render(<IndicatorDistributionBar segments={[]} />);
    const track = container.firstElementChild as HTMLElement;

    expect(track.children).toHaveLength(0);
  });

  it('carries no hardcoded visible text of its own — every title is built purely from props', () => {
    const { container } = render(<IndicatorDistributionBar segments={SEGMENTS} />);
    expect(container.textContent).toBe('');
  });
});
