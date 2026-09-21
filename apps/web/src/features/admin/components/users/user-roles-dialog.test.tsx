import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRolesDialog } from './user-roles-dialog';

import type { AdminUser, Role } from '../../types';

/**
 * A5-F02 — regression coverage for `UserRolesDialog`'s role list. Before
 * this fix, it called `adminApi.listRoles(1, 100)` once — a role ranked
 * past the first 100 (`GET /admin/roles` has no name search, only
 * `page`/`pageSize`) could never be shown or assigned, silently. This test
 * seeds two pages (101 roles total) and proves the role on page 2 is
 * fetched and offered.
 *
 * Reverting the fix (back to a single `listRoles(1, 100)` call) makes this
 * test fail: `listRolesMock` would only ever be called once, and the
 * page-2 role's checkbox would never render.
 */

const { listRolesMock, replaceUserRolesMock } = vi.hoisted(() => ({
  listRolesMock: vi.fn(),
  replaceUserRolesMock: vi.fn(),
}));

vi.mock('../../api', () => ({
  adminApi: {
    listRoles: listRolesMock,
    replaceUserRoles: replaceUserRolesMock,
  },
}));

function roleFixture(index: number): Role {
  return {
    id: `role-${index}`,
    name: `Papel ${index}`,
    description: `Descrição do papel ${index}`,
    isSystem: false,
    permissions: [],
    assignedUserCount: 0,
  };
}

const PAGE_1_ROLES = Array.from({ length: 100 }, (_, i) => roleFixture(i + 1));
const PAGE_2_ROLE = roleFixture(101);

const baseUser: AdminUser = {
  id: 'user-1',
  email: 'ana.souza@pharosgrc.local',
  fullName: 'Ana Souza',
  jobTitle: null,
  status: 'ACTIVE',
  primaryOrgUnit: null,
  roles: [],
  authenticationMethods: [],
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  listRolesMock.mockReset();
  replaceUserRolesMock.mockReset();
  listRolesMock.mockImplementation((page: number) => {
    if (page === 1) {
      return Promise.resolve({
        data: PAGE_1_ROLES,
        meta: { page: 1, pageSize: 100, total: 101, totalPages: 2 },
      });
    }
    return Promise.resolve({
      data: [PAGE_2_ROLE],
      meta: { page: 2, pageSize: 100, total: 101, totalPages: 2 },
    });
  });
});

describe('UserRolesDialog — role list pagination (A5-F02)', () => {
  it('fetches every page of GET /admin/roles, not only the first', async () => {
    render(
      <UserRolesDialog
        user={baseUser}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    );

    await waitFor(() => expect(listRolesMock).toHaveBeenCalledWith(1, 100));
    await waitFor(() => expect(listRolesMock).toHaveBeenCalledWith(2, 100));
  });

  it('shows and allows selecting a role ranked beyond the first 100', async () => {
    render(
      <UserRolesDialog
        user={baseUser}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(await screen.findByText('Papel 101')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Papel 101/ })).toBeInTheDocument();
  });
});
