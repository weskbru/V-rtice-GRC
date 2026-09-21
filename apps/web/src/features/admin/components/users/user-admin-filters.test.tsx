import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UserAdminFilters } from './user-admin-filters';

import type { UserAdminFiltersProps } from './user-admin-filters';

/**
 * PharosGRC — Administration, users filter toolbar composition.
 *
 * Regression coverage for a real defect a rendered check found: the search
 * term reached the URL and the "Filtros N" badge counted it correctly, but
 * the CHIP ROW never rendered a chip for it — `activeFilterChips` was built
 * from `singleValueChip` alone, with no `searchChip`. A caller who typed a
 * search term and then opened the collapsed panel had no way to see — or
 * remove — that filter without clearing everything. Reverting the fix (the
 * missing `searchChip(...)` entry) makes the first test below fail.
 */

const { listRolesMock } = vi.hoisted(() => ({ listRolesMock: vi.fn() }));

vi.mock('../../api', () => ({
  adminApi: { listRoles: listRolesMock },
}));

const ORG_UNITS = [
  {
    id: 'org-1',
    code: 'TI',
    name: 'Tecnologia da Informação',
    parentId: null,
    depth: 0,
    status: 'ACTIVE' as const,
    childCount: 0,
  },
];

function renderFilters(overrides: Partial<UserAdminFiltersProps> = {}) {
  const props: UserAdminFiltersProps = {
    searchValue: '',
    onSearchChange: vi.fn(),
    status: undefined,
    onStatusChange: vi.fn(),
    orgUnitId: undefined,
    onOrgUnitIdChange: vi.fn(),
    roleId: undefined,
    onRoleIdChange: vi.fn(),
    orgUnits: ORG_UNITS,
    hasActiveFilters: false,
    activeFilterCount: 0,
    onClearFilters: vi.fn(),
    ...overrides,
  };
  render(<UserAdminFilters {...props} />);
  return props;
}

describe('UserAdminFilters', () => {
  it('renders a chip for the search term AND a chip for a single-value filter, each individually removable', () => {
    listRolesMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
    });
    const props = renderFilters({
      searchValue: 'ana',
      status: 'ACTIVE',
      hasActiveFilters: true,
      activeFilterCount: 2,
    });

    expect(screen.getByText('Busca: "ana"')).toBeInTheDocument();
    expect(screen.getByText('Status: Ativo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Busca: "ana"' }));
    expect(props.onSearchChange).toHaveBeenCalledWith('');

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Status: Ativo' }));
    expect(props.onStatusChange).toHaveBeenCalledWith(undefined);
  });

  it('renders no chip at all when no filter is active', async () => {
    listRolesMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
    });
    renderFilters();

    await waitFor(() => expect(listRolesMock).toHaveBeenCalled());
    expect(screen.queryByText(/^Busca:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Status:/)).not.toBeInTheDocument();
  });

  it('renders a chip for the Unidade organizacional filter using the org unit name, not the raw id', () => {
    listRolesMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
    });
    renderFilters({ orgUnitId: 'org-1', hasActiveFilters: true, activeFilterCount: 1 });

    expect(
      screen.getByText('Unidade organizacional: Tecnologia da Informação'),
    ).toBeInTheDocument();
  });
});
