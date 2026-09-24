import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RolePrivilegeBadge } from './role-privilege-badge';

describe('RolePrivilegeBadge', () => {
  it('prints the label as text, never as colour alone (NFR-004)', () => {
    render(<RolePrivilegeBadge roleName="Platform Administrator" />);
    expect(screen.getByText('Privilegiado')).toBeInTheDocument();
  });

  it('states what the label MEANS about this specific role, not just the bare word', () => {
    render(<RolePrivilegeBadge roleName="Platform Administrator" />);
    expect(
      screen.getByText('Platform Administrator concede permissões de administração de acesso'),
    ).toBeInTheDocument();
  });

  it('is presentation only: it exposes no control, no input and no interactive role', () => {
    const { container } = render(<RolePrivilegeBadge roleName="Platform Administrator" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('[contenteditable]')).toBeNull();
  });

  it('names the role it is attached to, so two badges on one screen are not interchangeable', () => {
    render(
      <>
        <RolePrivilegeBadge roleName="Platform Administrator" />
        <RolePrivilegeBadge roleName="Gestor de Acessos" />
      </>,
    );
    expect(
      screen.getByText('Platform Administrator concede permissões de administração de acesso'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Gestor de Acessos concede permissões de administração de acesso'),
    ).toBeInTheDocument();
  });
});
