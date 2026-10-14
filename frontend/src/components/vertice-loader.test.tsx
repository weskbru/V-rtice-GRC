import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VerticeLoader, useDelayedVisibility } from '@vertice/design-system/components';

describe('VerticeLoader', () => {
  it('announces the wait once, hides the drawing from assistive technology, and draws the three pulse facets in order', () => {
    const { container } = render(<VerticeLoader label="Carregando página…" />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Carregando página…');

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '0 0 100 100');

    const facets = container.querySelectorAll('.vertice-loader-signal');
    expect(facets).toHaveLength(3);
    expect(facets[0]).toHaveClass('vertice-loader-signal-1');
    expect(facets[1]).toHaveClass('vertice-loader-signal-2');
    expect(facets[2]).toHaveClass('vertice-loader-signal-3');
    expect(facets[0]?.getAttribute('d')).toContain('M50 38');
    expect(facets[2]?.getAttribute('d')).toContain('M50 8');

    const markPaths = container.querySelectorAll('path:not(.vertice-loader-signal)');
    expect(markPaths).toHaveLength(2);
  });

  it('keeps the label available to screen readers when it is visually hidden', () => {
    render(<VerticeLoader label="Executando relatório…" variant="inline" hideLabel />);
    expect(screen.getByRole('status')).toHaveTextContent('Executando relatório…');
    expect(screen.getByText('Executando relatório…')).toHaveClass('sr-only');
  });
});

describe('useDelayedVisibility', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows nothing when the operation settles before the delay', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedVisibility(active), {
      initialProps: { active: true },
    });

    act(() => void vi.advanceTimersByTime(150));
    expect(result.current).toBe(false);

    rerender({ active: false });
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current).toBe(false);
  });

  it('shows the indicator once the wait passes the delay', () => {
    const { result } = renderHook(() => useDelayedVisibility(true));

    act(() => void vi.advanceTimersByTime(199));
    expect(result.current).toBe(false);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('keeps it on screen for the minimum once shown, instead of blinking away', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedVisibility(active), {
      initialProps: { active: true },
    });

    act(() => void vi.advanceTimersByTime(200));
    expect(result.current).toBe(true);

    rerender({ active: false });
    act(() => void vi.advanceTimersByTime(399));
    expect(result.current).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe(false);
  });

  it('stays visible when a new operation starts during the minimum window', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedVisibility(active), {
      initialProps: { active: true },
    });
    act(() => void vi.advanceTimersByTime(200));

    rerender({ active: false });
    act(() => void vi.advanceTimersByTime(100));
    rerender({ active: true });
    act(() => void vi.advanceTimersByTime(1000));

    expect(result.current).toBe(true);
  });
});
