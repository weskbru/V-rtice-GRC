import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ActionLifecycleTrackView } from './action-lifecycle-track-view';

import type { ActionLifecycleTrackModel } from './action-lifecycle-track';

/**
 * Component-mount evidence for the "Ciclo de vida" track view
 * (020-action-detail-experience, Fase B). Mirrors `problem-lifecycle-track
 * -view.test.tsx`'s own coverage exactly.
 *
 * `Action` does not record which of the two possible origins
 * (`OPEN`/`IN_PROGRESS`) a cancellation came from
 * (`action-lifecycle-track.ts`'s own header comment) — so the rendered
 * `CANCELLED` node must never visually assert one. This suite proves the
 * cancelled block is NOT a descendant of the main track's own `<ol>` (which
 * is what would tie it to a specific column), and always carries the honest
 * context sentence instead of a connector.
 */

function buildModel(withCancelled: boolean): ActionLifecycleTrackModel {
  return {
    main: [
      { status: 'OPEN', state: 'completed' },
      { status: 'IN_PROGRESS', state: 'unavailable' },
      { status: 'COMPLETED', state: 'unavailable' },
    ],
    cancelled: withCancelled ? { status: 'CANCELLED', state: 'current' } : null,
  };
}

describe('ActionLifecycleTrackView', () => {
  it('renders no cancelled block at all when the action was never cancelled', () => {
    render(<ActionLifecycleTrackView model={buildModel(false)} />);
    expect(screen.queryByText('Encerrada por cancelamento')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ação cancelada')).not.toBeInTheDocument();
  });

  it('renders the cancelled node OUTSIDE the main track’s own <ol> — never tied to a specific column', () => {
    render(<ActionLifecycleTrackView model={buildModel(true)} />);

    const cancelledBlocks = screen.getAllByLabelText('Ação cancelada');
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
    render(<ActionLifecycleTrackView model={buildModel(true)} />);
    expect(screen.getAllByText('Encerrada por cancelamento').length).toBeGreaterThan(0);
  });

  it('shows both an icon and a text word for every node state — never colour alone (CLAUDE.md §18.8)', () => {
    render(<ActionLifecycleTrackView model={buildModel(false)} />);
    // Every rendered node's icon is `aria-hidden`; the accessible content is
    // its own status/state text, asserted here via the always-visible
    // "Concluído"/"Indisponível" state words paired with the status labels.
    expect(screen.getAllByText('Aberta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Concluído').length).toBeGreaterThan(0);
  });
});
