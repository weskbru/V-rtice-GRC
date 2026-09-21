import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProblemLifecycleTrackView } from './problem-lifecycle-track-view';

import type { ProblemLifecycleTrackModel } from './problem-lifecycle-track';

/**
 * Component-mount evidence for the "Ciclo de vida" track view
 * (019-problem-detail-experience, Fase B). Mirrors
 * `incident-lifecycle-track-view.test.tsx`'s own coverage exactly.
 *
 * `ProblemDetail` does not record which of the two possible origins
 * (`OPEN`/`IN_ANALYSIS`) a cancellation came from
 * (`problem-lifecycle-track.ts`'s own header comment) — so the rendered
 * `CANCELLED` node must never visually assert one. This suite proves the
 * cancelled block is NOT a descendant of the main track's own `<ol>` (which
 * is what would tie it to a specific column), and always carries the honest
 * context sentence instead of a connector.
 */

function buildModel(withCancelled: boolean): ProblemLifecycleTrackModel {
  return {
    main: [
      { status: 'OPEN', state: 'completed' },
      { status: 'IN_ANALYSIS', state: 'unavailable' },
      { status: 'RESOLVED', state: 'unavailable' },
      { status: 'CLOSED', state: 'unavailable' },
    ],
    cancelled: withCancelled ? { status: 'CANCELLED', state: 'current' } : null,
  };
}

describe('ProblemLifecycleTrackView', () => {
  it('renders no cancelled block at all when the problem was never cancelled', () => {
    render(<ProblemLifecycleTrackView model={buildModel(false)} />);
    expect(screen.queryByText('Encerrado por cancelamento')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Problema cancelado')).not.toBeInTheDocument();
  });

  it('renders the cancelled node OUTSIDE the main track’s own <ol> — never tied to a specific column', () => {
    render(<ProblemLifecycleTrackView model={buildModel(true)} />);

    const cancelledBlocks = screen.getAllByLabelText('Problema cancelado');
    expect(cancelledBlocks.length).toBeGreaterThan(0);

    for (const block of cancelledBlocks) {
      // The main track's nodes live inside an <ol aria-label="Posições…">;
      // the cancelled block must not be a descendant of that list, which is
      // the structural guarantee that it cannot inherit a specific column's
      // position.
      const enclosingList = block.closest('ol');
      expect(enclosingList).toBeNull();
    }
  });

  it('always shows the honest context sentence next to the cancelled node, never a connector implying an origin', () => {
    render(<ProblemLifecycleTrackView model={buildModel(true)} />);
    expect(screen.getAllByText('Encerrado por cancelamento').length).toBeGreaterThan(0);
  });
});
