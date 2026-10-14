import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ActionLifecycleTrackView } from './action-lifecycle-track-view';

import type { ActionLifecycleTrackModel } from './action-lifecycle-track';

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
    expect(screen.getAllByText('Aberta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Concluído').length).toBeGreaterThan(0);
  });
});
