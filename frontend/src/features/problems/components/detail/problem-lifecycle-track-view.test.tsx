import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProblemLifecycleTrackView } from './problem-lifecycle-track-view';

import type { ProblemLifecycleTrackModel } from './problem-lifecycle-track';

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
      const enclosingList = block.closest('ol');
      expect(enclosingList).toBeNull();
    }
  });

  it('always shows the honest context sentence next to the cancelled node, never a connector implying an origin', () => {
    render(<ProblemLifecycleTrackView model={buildModel(true)} />);
    expect(screen.getAllByText('Encerrado por cancelamento').length).toBeGreaterThan(0);
  });
});
