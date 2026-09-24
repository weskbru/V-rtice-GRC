import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { DashboardHero } from './dashboard-hero';

function renderHero(fullName: string) {
  return render(
    <AuthProvider
      initialSession={buildTestSession({ user: { ...buildTestSession().user, fullName } })}
    >
      <DashboardHero />
    </AuthProvider>,
  );
}

describe('DashboardHero', () => {
  it('greets the signed-in user by first name only, and renders the page title once', () => {
    renderHero('Ada Analyst');

    expect(screen.getByText('Olá, Ada')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('keeps the decorative illustration out of the accessibility tree', () => {
    const { container } = renderHero('Ada Analyst');

    const illustration = container.querySelector('[aria-hidden="true"]');
    expect(illustration).not.toBeNull();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });
});
