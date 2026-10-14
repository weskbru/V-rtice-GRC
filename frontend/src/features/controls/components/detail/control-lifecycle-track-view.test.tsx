import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ControlLifecycleTrackView } from './control-lifecycle-track-view';

import type { ControlLifecycleTrackModel } from './control-lifecycle-track';

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
