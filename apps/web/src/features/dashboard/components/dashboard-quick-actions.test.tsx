import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { DashboardQuickActions } from './dashboard-quick-actions';

function renderWith(permissions: readonly string[]): ReturnType<typeof render> {
  return render(
    <AuthProvider initialSession={buildTestSession({ permissions: [...permissions] })}>
      <DashboardQuickActions />
    </AuthProvider>,
  );
}

describe('DashboardQuickActions', () => {
  it('offers only the shortcuts the caller may actually use', () => {
    renderWith(['risk:create', 'action:view', 'report:view']);

    expect(screen.getByRole('link', { name: 'Registrar risco' })).toHaveAttribute(
      'href',
      '/risks/new',
    );
    expect(screen.getByRole('link', { name: 'Meus planos de ação' })).toHaveAttribute(
      'href',
      '/actions',
    );
    expect(screen.getByRole('link', { name: 'Abrir relatórios' })).toHaveAttribute(
      'href',
      '/reports',
    );
    expect(screen.queryByRole('link', { name: 'Registrar incidente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Registrar problema' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver indicadores' })).not.toBeInTheDocument();
  });

  it('renders nothing at all — heading included — when no shortcut is available', () => {
    const { container } = renderWith(['risk:view']);

    expect(container).toBeEmptyDOMElement();
  });

  it('names the section and groups the shortcuts under that name', () => {
    renderWith(['risk:create']);

    expect(screen.getByRole('heading', { name: 'Ações rápidas' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ações rápidas' })).toBeInTheDocument();
  });

  it('gives each shortcut its area icon, decorative to assistive technology', () => {
    const { container } = renderWith(['incident:create']);

    const link = screen.getByRole('link', { name: 'Registrar incidente' });
    const icon = link.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });
});
