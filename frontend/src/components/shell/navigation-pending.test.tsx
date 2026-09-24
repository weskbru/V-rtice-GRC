import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LinkPendingSignal,
  NavigationPendingOverlay,
  NavigationPendingProvider,
  useNavigate,
} from './navigation-pending';

const { linkStatusMock, routerMock } = vi.hoisted(() => ({
  linkStatusMock: vi.fn(),
  routerMock: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() },
}));

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }));

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <a href="#stub">{children}</a>,
  useLinkStatus: linkStatusMock,
}));

function Shell({ signals }: { signals: number }): React.JSX.Element {
  return (
    <NavigationPendingProvider>
      {Array.from({ length: signals }, (_, index) => (
        <LinkPendingSignal key={index} />
      ))}
      <NavigationPendingOverlay />
    </NavigationPendingProvider>
  );
}

const overlay = (): HTMLElement | null => document.querySelector('[data-navigation-pending]');

beforeEach(() => {
  vi.useFakeTimers();
  linkStatusMock.mockReturnValue({ pending: false });
  for (const spy of Object.values(routerMock)) spy.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('navigation pending overlay', () => {
  it('shows nothing while no link reports a pending navigation', () => {
    render(<Shell signals={2} />);
    act(() => void vi.advanceTimersByTime(1000));
    expect(overlay()).toBeNull();
  });

  it('does not flash for a navigation that completes before the delay', () => {
    linkStatusMock.mockReturnValue({ pending: true });
    const { rerender } = render(<Shell signals={1} />);

    act(() => void vi.advanceTimersByTime(150));
    expect(overlay()).toBeNull();

    linkStatusMock.mockReturnValue({ pending: false });
    rerender(<Shell signals={1} />);
    act(() => void vi.advanceTimersByTime(2000));
    expect(overlay()).toBeNull();
  });

  it('covers the main region with the institutional loader once a navigation outlasts the delay', () => {
    linkStatusMock.mockReturnValue({ pending: true });
    render(<Shell signals={1} />);

    act(() => void vi.advanceTimersByTime(200));

    expect(overlay()).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando página…');
  });

  it('removes the overlay after the navigation commits', () => {
    linkStatusMock.mockReturnValue({ pending: true });
    const { rerender } = render(<Shell signals={1} />);
    act(() => void vi.advanceTimersByTime(200));

    linkStatusMock.mockReturnValue({ pending: false });
    rerender(<Shell signals={1} />);
    act(() => void vi.advanceTimersByTime(1000));

    expect(overlay()).toBeNull();
  });

  it('clears the pending state when the reporting link unmounts mid-navigation', () => {
    linkStatusMock.mockReturnValue({ pending: true });
    const { rerender } = render(<Shell signals={1} />);
    act(() => void vi.advanceTimersByTime(200));
    expect(overlay()).not.toBeNull();

    rerender(<Shell signals={0} />);
    act(() => void vi.advanceTimersByTime(1000));

    expect(overlay()).toBeNull();
  });
});

describe('useNavigate', () => {
  function Trigger({ run }: { run: (navigate: ReturnType<typeof useNavigate>) => void }): null {
    const navigate = useNavigate();
    run(navigate);
    return null;
  }

  const drive = (
    run: (navigate: ReturnType<typeof useNavigate>) => void,
    withProvider = true,
  ): void => {
    const trigger = <Trigger run={run} />;
    render(
      withProvider ? <NavigationPendingProvider>{trigger}</NavigationPendingProvider> : trigger,
    );
  };

  it('pushes by default and replaces on request', () => {
    drive((navigate) => navigate('/risks/1'));
    expect(routerMock.push).toHaveBeenCalledWith('/risks/1');

    drive((navigate) => navigate('/profile', { replace: true }));
    expect(routerMock.replace).toHaveBeenCalledWith('/profile');
  });

  it('forwards back and refresh', () => {
    drive((navigate) => navigate.back());
    expect(routerMock.back).toHaveBeenCalled();

    drive((navigate) => navigate.refresh());
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it('still navigates when rendered outside the shell, where there is no overlay to feed', () => {
    drive((navigate) => navigate('/login'), false);
    expect(routerMock.push).toHaveBeenCalledWith('/login');
  });
});
