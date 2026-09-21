import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { risks } from '@/lib/messages/risks';

import { SortSelect } from './sort-select';

/**
 * The ordering control of every register screen.
 *
 * The behaviour worth protecting is not "a select renders": it is that the
 * control can always NAME the ordering in force. A register's presets cover
 * the orderings worth offering by name, but a sortable column header can
 * produce any field/direction pair — "Título" clicked twice is `title:desc`,
 * deliberately not a preset — and a control showing nothing selected while
 * the list is demonstrably sorted is a defect (CLAUDE.md §18.11).
 *
 * Written against the Risks catalog because that is the register with the
 * richest preset list; the component itself knows nothing about risks.
 */
describe('SortSelect', () => {
  it('shows the preset matching the ordering in force', () => {
    render(
      <SortSelect
        labels={risks.register.results}
        sort="updatedAt"
        direction="desc"
        onSortChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveTextContent(
      'Mais recentes',
    );
  });

  it('composes an option for an ordering that is not one of the presets', () => {
    render(
      <SortSelect
        labels={risks.register.results}
        // `title:asc` is the preset "Título (A–Z)"; `title:desc` is what a
        // second click on the column header produces, and has no preset.
        sort="title"
        direction="desc"
        onSortChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveTextContent(
      'Título (decrescente)',
    );
  });

  /*
   * Choosing an option is deliberately NOT exercised here: Radix's
   * `Select` is portal- and pointer-capture-heavy, which jsdom does not
   * model (vitest.config.ts's own note), so this project covers that
   * interaction in Playwright instead — `e2e/risk-register.spec.ts` picks
   * "Título (A–Z)" and asserts both the resulting order and the URL. What
   * jsdom can prove is everything above and below: which ordering the
   * control claims to be in, and how it is named.
   */

  it('keeps the visible caption out of the control’s accessible name', () => {
    render(
      <SortSelect
        labels={risks.register.results}
        prefix={risks.register.results.sortLabel}
        sort="code"
        direction="asc"
        onSortChange={vi.fn()}
      />,
    );

    // The caption is on screen for a sighted reader…
    expect(screen.getAllByText('Ordenar por').length).toBeGreaterThan(0);
    // …and the control is still named exactly once for a screen reader.
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveAccessibleName(
      'Ordenar por',
    );
  });
});
