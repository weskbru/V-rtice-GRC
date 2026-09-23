import { PharosLoader, useDelayedVisibility } from '@pharos/design-system/components';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('PharosLoader', () => {
  it('announces the wait once, hides the drawing from assistive technology, and draws the three signal arcs in order', () => {
    const { container } = render(<PharosLoader label="Carregando página…" />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Carregando página…');

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('viewBox', '28 21 45 73');

    const arcs = container.querySelectorAll('.pharos-loader-signal');
    expect(arcs).toHaveLength(3);
    expect(arcs[0]).toHaveClass('pharos-loader-signal-1');
    expect(arcs[1]).toHaveClass('pharos-loader-signal-2');
    expect(arcs[2]).toHaveClass('pharos-loader-signal-3');
    expect(arcs[0]?.getAttribute('d')).toContain('A20.00 20.00');
    expect(arcs[2]?.getAttribute('d')).toContain('A40.00 40.00');

    const towerPaths = container.querySelectorAll('path:not(.pharos-loader-signal)');
    expect(towerPaths).toHaveLength(6);
  });

  it('keeps the label available to screen readers when it is visually hidden', () => {
    render(<PharosLoader label="Executando relatório…" variant="inline" hideLabel />);
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
