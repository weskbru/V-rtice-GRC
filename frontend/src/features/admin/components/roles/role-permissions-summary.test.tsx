import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { groupPermissionsByResource } from './permission-grouping';
import { RolePermissionsSummary } from './role-permissions-summary';

import type { Permission } from '../../types';

const PERMISSIONS: readonly Permission[] = [
  { identifier: 'risk:view', resource: 'risk', action: 'VIEW', description: 'Visualizar riscos' },
  { identifier: 'risk:edit', resource: 'risk', action: 'EDIT', description: 'Editar riscos' },
  {
    identifier: 'user:administer',
    resource: 'user',
    action: 'ADMINISTER',
    description: 'Administrar usuários',
  },
  {
    identifier: 'role:administer',
    resource: 'role',
    action: 'ADMINISTER',
    description: 'Administrar papéis',
  },
];

describe('groupPermissionsByResource', () => {
  it('groups by resource, sorted alphabetically', () => {
    const groups = groupPermissionsByResource(PERMISSIONS);
    expect(groups.map((group) => group.resource)).toEqual(['risk', 'role', 'user']);
    expect(groups[0]?.permissions).toHaveLength(2);
  });
});

describe('RolePermissionsSummary', () => {
  it('shows a "none" placeholder for a role with no permissions', () => {
    render(<RolePermissionsSummary roleName="Vazio" permissions={[]} />);
    expect(screen.getByText('Nenhuma permissão')).toBeInTheDocument();
  });

  it('previews a handful of identifiers and expands to the full, grouped, read-only list on request', () => {
    render(
      <RolePermissionsSummary
        roleName="Platform Administrator"
        permissions={PERMISSIONS}
        previewCount={2}
      />,
    );

    expect(screen.getByText('risk:view')).toBeInTheDocument();
    expect(screen.getByText('risk:edit')).toBeInTheDocument();
    expect(screen.queryByText('user:administer')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /\+2/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(screen.getByText('user:administer')).toBeInTheDocument();
    expect(screen.getByText('role:administer')).toBeInTheDocument();
    expect(screen.getByText('Administrar usuários')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
