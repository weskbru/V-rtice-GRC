import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UserRoleBadges } from './user-role-badges';

import type { AdminRoleRef } from '../../types';

/**
 * Component-mount evidence for `UserRoleBadges`'s "+N" overflow control —
 * the coordinator's explicit requirement that every hidden role name stays
 * reachable by a screen reader, not only by hover or a `title` tooltip —
 * and for the deterministic one-line fit behind BOTH of its callers
 * (`widthBudget` as a number for the table, `'measure'` for the card; see
 * this component's own header for why the two differ).
 *
 * `widthBudget: 'measure'` always yields exactly one visible badge (plus
 * "+N" when more than one role exists) under jsdom: `ResizeObserver` is a
 * no-op polyfill there (`vitest.setup.ts`) and `clientWidth` is always 0,
 * which is this component's own documented "never show zero roles"
 * fallback — not a bug in these tests, the fixed-pixel tests below exercise
 * the real fit arithmetic instead.
 */
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

    // pt-BR display names (`roleDisplayName`, ADR-022) — never the stored, English `Role.name`.
    expect(screen.getByText('Analista de Riscos')).toBeInTheDocument();
    expect(screen.getByText('Auditor')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  const FOUR_ROLES = [
    role('r1', 'Risk Analyst'), // "Analista de Riscos"
    role('r2', 'Auditor'), // "Auditor"
    role('r3', 'Control Owner'), // "Responsável por Controle"
    role('r4', 'Read Only'), // "Somente Leitura"
  ];

  it("the '+N' trigger's own accessible name states how many more roles there are AND what they are", () => {
    // Deterministic character-width estimate (this component's own header):
    // at 150px, only the first label ("Analista de Riscos", 18 chars ≈
    // 140px) fits before the "+N" reserve would be exceeded.
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
    // The `EmptyValue` branch renders no row `<div>` at all, so the very
    // first render of this test has nothing for `ResizeObserver` to attach
    // to. Before the fix, the measuring effect was keyed only on
    // `widthBudget === 'measure'` (unchanged across the rerender below) and
    // read a `useRef` that had captured `null` on that first, div-less
    // render — so the row was never observed and stayed stuck at the
    // zero-roles fallback (one badge + "+N") even once real roles, and real
    // width, arrived. A card re-rendering after the "assign roles" dialog
    // succeeds and its query refetches is exactly this sequence.
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

      // The row mounted for the first time on this rerender — it must have
      // been observed, and the stubbed 1000px `clientWidth` must have been
      // used to fit all four roles with no overflow.
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
