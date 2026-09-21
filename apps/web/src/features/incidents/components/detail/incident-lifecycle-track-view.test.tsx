import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IncidentLifecycleTrackView } from './incident-lifecycle-track-view';

import type { IncidentLifecycleTrackModel } from './incident-lifecycle-track';

/**
 * Component-mount evidence for the "Ciclo de vida" track view
 * (018-incident-detail-experience, Fase 4 review correction C2).
 *
 * `IncidentDetail` does not record which of the two possible origins
 * (`OPEN`/`IN_PROGRESS`) a cancellation came from
 * (`incident-lifecycle-track.ts`'s own header comment) — so the rendered
 * `CANCELLED` node must never visually assert one. Before this correction,
 * it hung off a dashed LEFT border flush with the row's own left edge,
 * which measured directly under "Aberto"'s column, reading as "cancelled
 * from Aberto". This suite proves the corrected structure: the cancelled
 * block is NOT a descendant of the main track's own `<ol>` (which is what
 * would tie it to a specific column), and always carries the honest
 * context sentence instead of a connector.
 */

function buildModel(withCancelled: boolean): IncidentLifecycleTrackModel {
  return {
    main: [
      { status: 'OPEN', state: 'completed' },
      { status: 'IN_PROGRESS', state: 'unavailable' },
      { status: 'RESOLVED', state: 'unavailable' },
      { status: 'CLOSED', state: 'unavailable' },
    ],
    cancelled: withCancelled ? { status: 'CANCELLED', state: 'current' } : null,
  };
}

describe('IncidentLifecycleTrackView', () => {
  it('renders no cancelled block at all when the incident was never cancelled', () => {
    render(<IncidentLifecycleTrackView model={buildModel(false)} />);
    expect(screen.queryByText('Encerrado por cancelamento')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Incidente cancelado')).not.toBeInTheDocument();
  });

  it('renders the cancelled node OUTSIDE the main track’s own <ol> — never tied to a specific column', () => {
    render(<IncidentLifecycleTrackView model={buildModel(true)} />);

    const cancelledBlocks = screen.getAllByLabelText('Incidente cancelado');
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
    render(<IncidentLifecycleTrackView model={buildModel(true)} />);
    expect(screen.getAllByText('Encerrado por cancelamento').length).toBeGreaterThan(0);
  });
});
