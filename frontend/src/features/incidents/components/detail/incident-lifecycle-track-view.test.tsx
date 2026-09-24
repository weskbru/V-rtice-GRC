import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IncidentLifecycleTrackView } from './incident-lifecycle-track-view';

import type { IncidentLifecycleTrackModel } from './incident-lifecycle-track';

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
      const enclosingList = block.closest('ol');
      expect(enclosingList).toBeNull();
    }
  });

  it('always shows the honest context sentence next to the cancelled node, never a connector implying an origin', () => {
    render(<IncidentLifecycleTrackView model={buildModel(true)} />);
    expect(screen.getAllByText('Encerrado por cancelamento').length).toBeGreaterThan(0);
  });
});
