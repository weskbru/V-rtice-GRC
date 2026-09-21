import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MyActionsFilters } from './my-actions-filters';

import type { ActionOriginType } from '../types';

import { actions } from '@/lib/messages/actions';

/**
 * Regression test for the origin-restatement defect (2026-09-11,
 * "confirmed drift" — the same class the coordinator closed server-side
 * in `CreateActionRequestDto`/`ListActionQueryDto`/the contract
 * document): this filter's own origin dropdown used to hardcode
 * `['RISK_TREATMENT', 'FINDING']`, silently excluding `CONTROL_ASSESSMENT`
 * (already live for months) and, later, `INCIDENT`/`PROBLEM`. Asserts the
 * dropdown actually OFFERS every real origin with a legible pt-BR label —
 * the "can a user filter by an incident's or a problem's work" question
 * this fix exists to answer, checked here rather than only by reading the
 * derivation.
 */
describe('MyActionsFilters', () => {
  const noop = (): void => undefined;

  function renderFilters(): void {
    render(
      <MyActionsFilters
        status={undefined}
        onStatusChange={noop}
        originType={undefined}
        onOriginTypeChange={noop}
        onlyMine={false}
        onOnlyMineChange={noop}
        onlyOverdue={false}
        onOnlyOverdueChange={noop}
        hasActiveFilters={false}
        activeFilterCount={0}
        onClearFilters={noop}
      />,
    );
    // The filter controls live behind the "Filtros" disclosure now that this
    // toolbar is collapsible (CLAUDE.md §18.12) — opening it is what makes
    // the `Select`s reachable at all (`FilterBar`'s own F-71 doc comment:
    // the panel's contents mount only while open).
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(actions.myActions.filters.groupLabel) }),
    );
  }

  it('offers all five real Action origins in the origin filter, each with its pt-BR label', async () => {
    renderFilters();

    fireEvent.click(screen.getByRole('combobox', { name: actions.myActions.filters.originLabel }));

    const expectedOrigins: readonly ActionOriginType[] = [
      'RISK_TREATMENT',
      'FINDING',
      'CONTROL_ASSESSMENT',
      'INCIDENT',
      'PROBLEM',
    ];
    for (const origin of expectedOrigins) {
      expect(
        await screen.findByRole('option', { name: actions.originTypeLabels[origin] }),
      ).toBeInTheDocument();
    }
  });

  it('keeps presentation controls visible while the no-search filter panel is collapsed', () => {
    render(
      <MyActionsFilters
        presentationControls={<button type="button">Alternar visualização</button>}
        status={undefined}
        onStatusChange={noop}
        originType={undefined}
        onOriginTypeChange={noop}
        onlyMine
        onOnlyMineChange={noop}
        onlyOverdue={false}
        onOnlyOverdueChange={noop}
        hasActiveFilters={false}
        activeFilterCount={0}
        onClearFilters={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Alternar visualização' })).toBeVisible();
  });

  it('calls onOriginTypeChange with the selected origin, including the two newest ones', async () => {
    const onOriginTypeChange = vi.fn();
    render(
      <MyActionsFilters
        status={undefined}
        onStatusChange={noop}
        originType={undefined}
        onOriginTypeChange={onOriginTypeChange}
        onlyMine={false}
        onOnlyMineChange={noop}
        onlyOverdue={false}
        onOnlyOverdueChange={noop}
        hasActiveFilters={false}
        activeFilterCount={0}
        onClearFilters={noop}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(actions.myActions.filters.groupLabel) }),
    );

    fireEvent.click(screen.getByRole('combobox', { name: actions.myActions.filters.originLabel }));
    fireEvent.click(await screen.findByRole('option', { name: actions.originTypeLabels.INCIDENT }));
    expect(onOriginTypeChange).toHaveBeenCalledWith('INCIDENT');

    fireEvent.click(screen.getByRole('combobox', { name: actions.myActions.filters.originLabel }));
    fireEvent.click(await screen.findByRole('option', { name: actions.originTypeLabels.PROBLEM }));
    expect(onOriginTypeChange).toHaveBeenCalledWith('PROBLEM');
  });
});
