import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UserRoleBadges } from './user-role-badges';

import type { AdminRoleRef } from '../../types';

function role(id: string, name: string): AdminRoleRef {
  return { id, name };
}

describe('UserRoleBadges', () => {
  it('renders EmptyValue when the user holds no role', () => {
    render(<UserRoleBadges roles={[]} widthBudget={200} />);
    expect(screen.getByText('Nenhum papel')).toBeInTheDocument();
  });

  it('renders every role as a plain badge — no overflow control — when they all fit the budget', () => {
    render(
      <UserRoleBadges
        roles={[role('r1', 'Risk Analyst'), role('r2', 'Auditor')]}
        widthBudget={1000}
      />,
    );

    expect(screen.getByText('Analista de Riscos')).toBeInTheDocument();
    expect(screen.getByText('Auditor')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  const FOUR_ROLES = [
    role('r1', 'Risk Analyst'),
    role('r2', 'Auditor'),
    role('r3', 'Control Owner'),
    role('r4', 'Read Only'),
  ];

  it("the '+N' trigger's own accessible name states how many more roles there are AND what they are", () => {
    render(<UserRoleBadges roles={FOUR_ROLES} widthBudget={150} />);

    expect(screen.getByText('Analista de Riscos')).toBeInTheDocument();
    expect(screen.queryByText('Auditor')).not.toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    const trigger = screen.getByRole('button', {
      name: 'Mais 3 papéis: Auditor, Responsável por Controle, Somente Leitura',
    });
    expect(trigger).toBeInTheDocument();
  });

  it('activating the trigger opens a Popover listing every hidden role name again, reachable without a hover', () => {
    render(<UserRoleBadges roles={FOUR_ROLES} widthBudget={150} />);

    const trigger = screen.getByRole('button', { name: /mais 3 papéis/i });
    fireEvent.click(trigger);

    expect(screen.getByRole('group', { name: 'Papéis adicionais' })).toBeInTheDocument();
    expect(screen.getByText('Auditor')).toBeInTheDocument();
    expect(screen.getByText('Responsável por Controle')).toBeInTheDocument();
    expect(screen.getByText('Somente Leitura')).toBeInTheDocument();
  });

  it('never renders zero roles — the first badge shows even when it alone does not fit the budget', () => {
    render(<UserRoleBadges roles={FOUR_ROLES} widthBudget={1} />);

    expect(screen.getByText('Analista de Riscos')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('always lays out as a single, non-wrapping line (`flex-nowrap`), whichever widthBudget mode is used', () => {
    const { container: fixed } = render(<UserRoleBadges roles={FOUR_ROLES} widthBudget={150} />);
    expect(fixed.firstChild).toHaveClass('flex-nowrap');

    const { container: measured } = render(
      <UserRoleBadges roles={FOUR_ROLES} widthBudget="measure" />,
    );
    expect(measured.firstChild).toHaveClass('flex-nowrap');
  });

  it('widthBudget="measure" (jsdom: unmeasurable, clientWidth always 0) still renders one badge plus "+N" for the rest, never zero', () => {
    render(<UserRoleBadges roles={FOUR_ROLES} widthBudget="measure" />);

    expect(screen.getByText('Analista de Riscos')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Mais 3 papéis: Auditor, Responsável por Controle, Somente Leitura',
      }),
    ).toBeInTheDocument();
  });

  it('widthBudget="measure" with a single role renders it with no overflow control at all', () => {
    render(<UserRoleBadges roles={[role('r1', 'Auditor')]} widthBudget="measure" />);

    expect(screen.getByText('Auditor')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('re-measures once roles arrive after starting empty — the same instance, not just a fresh mount', () => {
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(1000);
    const observedTargets: Element[] = [];
    const OriginalResizeObserver = window.ResizeObserver;
    /* eslint-disable @typescript-eslint/no-empty-function -- deliberate no-op stub, mirrors vitest.setup.ts's own ResizeObserver polyfill */
    class RecordingResizeObserver {
      observe(target: Element): void {
        observedTargets.push(target);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    /* eslint-enable @typescript-eslint/no-empty-function */
    window.ResizeObserver = RecordingResizeObserver;

    try {
      const { rerender } = render(<UserRoleBadges roles={[]} widthBudget="measure" />);
      expect(screen.getByText('Nenhum papel')).toBeInTheDocument();

      rerender(<UserRoleBadges roles={FOUR_ROLES} widthBudget="measure" />);

      expect(observedTargets).toHaveLength(1);
      expect(screen.getByText('Analista de Riscos')).toBeInTheDocument();
      expect(screen.getByText('Auditor')).toBeInTheDocument();
      expect(screen.getByText('Responsável por Controle')).toBeInTheDocument();
      expect(screen.getByText('Somente Leitura')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    } finally {
      window.ResizeObserver = OriginalResizeObserver;
      clientWidthSpy.mockRestore();
    }
  });
});
