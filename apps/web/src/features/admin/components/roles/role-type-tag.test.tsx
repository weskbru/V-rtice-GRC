import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoleTypeTag } from './role-type-tag';

/**
 * Component-mount evidence for the role-kind tag (roles screen refinement).
 * Both kinds must be told apart by text alone (CLAUDE.md §18.8 — color is
 * never the only indicator), and the system kind additionally carries a lock
 * glyph.
 */
describe('RoleTypeTag', () => {
  it('labels a system role "Sistema" and shows the lock glyph', () => {
    const { container } = render(<RoleTypeTag isSystem />);
    expect(screen.getByText('Sistema')).toBeInTheDocument();
    expect(screen.queryByText('Personalizado')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('labels a custom role "Personalizado" with no lock glyph', () => {
    const { container } = render(<RoleTypeTag isSystem={false} />);
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
    expect(screen.queryByText('Sistema')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
