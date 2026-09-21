import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { shell } from '@/lib/messages/shell';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { Sidebar } from './sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

/**
 * Component-mount evidence for T073 (`Sidebar`, FR-039, FR-042, FR-043).
 * Renders straight from `navigationRegistry` (T071) — the assertions below
 * are the concrete demonstration of the extension point.
 */

/**
 * jsdom has no layout engine and no real `matchMedia` — this stubs
 * `window.matchMedia` the way the sidebar itself consumes it (`matches` +
 * `addEventListener('change', ...)`/`removeEventListener`), and returns a
 * `fireChange` helper so a test can simulate a live resize without
 * remounting the component, per requirement 3 (the resize round trip).
 */
function mockMatchMedia(initialMatches: boolean): { fireChange: (matches: boolean) => void } {
  let matches = initialMatches;
  let changeListener: ((event: MediaQueryListEvent) => void) | null = null;

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') {
          changeListener = listener;
        }
      },
      removeEventListener: (type: string) => {
        if (type === 'change') {
          changeListener = null;
        }
      },
      dispatchEvent: vi.fn(),
    })),
  );

  return {
    fireChange(next: boolean) {
      matches = next;
      act(() => {
        changeListener?.({ matches: next } as MediaQueryListEvent);
      });
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Sidebar', () => {
  it('renders the implemented Dashboard entry as a link', () => {
    render(
      <AuthProvider initialSession={buildTestSession()}>
        <Sidebar />
      </AuthProvider>,
    );

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
  });

  /**
   * FR-043's rendering of a `status: 'planned'` entry moved to
   * `sidebar-planned-entry.test.tsx`, which asserts it against an explicit
   * fixture instead of against whichever module happened to be unbuilt.
   * The test that used to live here named "Planos de Ação" as that module,
   * and "Planos de Ação" is no longer a planned module at all — it is the
   * live screen this entry points at. Coverage moved; it was not dropped.
   *
   * What replaces it here is the regression guard for the defect that
   * removal fixed: the registry briefly carried BOTH a live "Planos de
   * Ação" link and a disabled "Planos de Ação" row marked "Planejado",
   * telling the reader the module was and was not built at the same time.
   */
  it('renders "Planos de Ação" exactly once, as a real link (regression)', () => {
    render(
      <AuthProvider
        initialSession={buildTestSession({ permissions: ['risk:view', 'action:view'] })}
      >
        <Sidebar />
      </AuthProvider>,
    );

    expect(screen.getAllByText('Planos de Ação')).toHaveLength(1);

    const link = screen.getByRole('link', { name: /Planos de Ação/ });
    expect(link).toHaveAttribute('href', '/actions');
    expect(screen.queryByText('Planejado')).toBeNull();
  });

  it('hides every Administration entry from a user without the corresponding permission (US8, FR-042)', () => {
    render(
      <AuthProvider initialSession={buildTestSession()}>
        <Sidebar />
      </AuthProvider>,
    );

    expect(screen.queryByRole('link', { name: /Usuários/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Papéis e permissões/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Estrutura organizacional/ })).toBeNull();
  });

  it('shows an Administration entry once the user holds its required permission (US8)', () => {
    render(
      <AuthProvider
        initialSession={buildTestSession({ permissions: ['risk:view', 'user:administer'] })}
      >
        <Sidebar />
      </AuthProvider>,
    );

    const usersLink = screen.getByRole('link', { name: /Usuários/ });
    expect(usersLink).toHaveAttribute('href', '/admin/users');
    // Still hidden: this session holds `user:administer` only, not `role:administer`/`org_unit:administer`.
    expect(screen.queryByRole('link', { name: /Papéis e permissões/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Estrutura organizacional/ })).toBeNull();
  });

  /**
   * Narrow-viewport defect fix (768px risk codes wrapping across three
   * lines and titles truncating to two characters, `docs/reviews/ui/
   * after-narrow`) — the rail must collapse itself below the `lg`
   * breakpoint (1024px, matching `app-shell.tsx`'s own content-padding
   * breakpoint) instead of staying at its full 256px width.
   */
  describe('narrow-viewport behaviour', () => {
    it('collapses automatically below the lg breakpoint (1024px)', () => {
      mockMatchMedia(false);

      render(
        <AuthProvider initialSession={buildTestSession()}>
          <Sidebar />
        </AuthProvider>,
      );

      // Collapsed: the label text is present for accessibility, but sr-only.
      expect(screen.getByText('Dashboard')).toHaveClass('sr-only');
    });

    it('does not offer the expand toggle below the breakpoint (nothing to expand into)', () => {
      mockMatchMedia(false);

      render(
        <AuthProvider initialSession={buildTestSession()}>
          <Sidebar />
        </AuthProvider>,
      );

      expect(screen.queryByRole('button', { name: shell.sidebar.expand })).toBeNull();
      expect(screen.queryByRole('button', { name: shell.sidebar.collapse })).toBeNull();
    });

    it("respects the user's explicit choice to collapse above the breakpoint", () => {
      mockMatchMedia(true);

      render(
        <AuthProvider initialSession={buildTestSession()}>
          <Sidebar />
        </AuthProvider>,
      );

      // Expanded by default: the label renders as visible text.
      expect(screen.getByText('Dashboard')).not.toHaveClass('sr-only');

      fireEvent.click(screen.getByRole('button', { name: shell.sidebar.collapse }));

      expect(screen.getByText('Dashboard')).toHaveClass('sr-only');
      expect(screen.getByRole('button', { name: shell.sidebar.expand })).toBeInTheDocument();
    });

    it('preserves an explicit collapse across a resize round trip (requirement 3)', () => {
      const { fireChange } = mockMatchMedia(true);

      render(
        <AuthProvider initialSession={buildTestSession()}>
          <Sidebar />
        </AuthProvider>,
      );

      fireEvent.click(screen.getByRole('button', { name: shell.sidebar.collapse }));
      expect(screen.getByRole('button', { name: shell.sidebar.expand })).toBeInTheDocument();

      // Narrow past the breakpoint: forced collapsed, toggle withdrawn.
      fireChange(false);
      expect(screen.queryByRole('button', { name: shell.sidebar.expand })).toBeNull();

      // Back above the breakpoint: the user's own collapse choice wins —
      // it must NOT come back expanded.
      fireChange(true);
      expect(screen.getByText('Dashboard')).toHaveClass('sr-only');
      expect(screen.getByRole('button', { name: shell.sidebar.expand })).toBeInTheDocument();
    });
  });
});
