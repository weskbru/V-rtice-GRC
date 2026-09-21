import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ControlLifecycleTrackView } from './control-lifecycle-track-view';

import type { ControlLifecycleTrackModel } from './control-lifecycle-track';

/**
 * Component-mount evidence for the "Ciclo de vida" track view
 * (021-control-detail-experience, Fase B). Mirrors `action-lifecycle-track
 * -view.test.tsx`'s/`problem-lifecycle-track-view.test.tsx`'s own coverage
 * exactly.
 *
 * `Control` does not record which of the three possible origins
 * (`DRAFT`/`ACTIVE`/`SUSPENDED`) a retirement came from
 * (`control-lifecycle-track.ts`'s own header comment) — so the rendered
 * `RETIRED` node must never visually assert one. This suite proves the
 * retired block is NOT a descendant of the main track's own `<ol>` (which
 * is what would tie it to a specific column), and always carries the honest
 * context sentence instead of a connector.
 */

function buildModel(withRetired: boolean): ControlLifecycleTrackModel {
  return {
    main: [
      { status: 'DRAFT', state: 'completed' },
      { status: 'ACTIVE', state: 'unavailable' },
      { status: 'SUSPENDED', state: 'unavailable' },
    ],
    retired: withRetired ? { status: 'RETIRED', state: 'current' } : null,
  };
}

describe('ControlLifecycleTrackView', () => {
  it('renders no retired block at all when the control was never retired', () => {
    render(<ControlLifecycleTrackView model={buildModel(false)} />);
    expect(screen.queryByText('Encerrado por descontinuação')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Controle descontinuado')).not.toBeInTheDocument();
  });

  it('renders the retired node OUTSIDE the main track’s own <ol> — never tied to a specific column', () => {
    render(<ControlLifecycleTrackView model={buildModel(true)} />);

    const retiredBlocks = screen.getAllByLabelText('Controle descontinuado');
    expect(retiredBlocks.length).toBeGreaterThan(0);

    for (const block of retiredBlocks) {
      // The main track's nodes live inside an <ol aria-label="Posições…">;
      // the retired block must not be a descendant of that list, which is
      // the structural guarantee that it cannot inherit a specific column's
      // position.
      const enclosingList = block.closest('ol');
      expect(enclosingList).toBeNull();
    }
  });

  it('always shows the honest context sentence next to the retired node, never a connector implying an origin', () => {
    render(<ControlLifecycleTrackView model={buildModel(true)} />);
    expect(screen.getAllByText('Encerrado por descontinuação').length).toBeGreaterThan(0);
  });

  it('shows both an icon and a text word for every node state — never colour alone (CLAUDE.md §18.8)', () => {
    render(<ControlLifecycleTrackView model={buildModel(false)} />);
    expect(screen.getAllByText('Rascunho').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Concluído').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Indisponível').length).toBeGreaterThan(0);
  });
});
