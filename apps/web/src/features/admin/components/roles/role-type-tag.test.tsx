import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoleTypeTag } from './role-type-tag';

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
