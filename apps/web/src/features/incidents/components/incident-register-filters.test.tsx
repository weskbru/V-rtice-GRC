import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IncidentRegisterFilters } from './incident-register-filters';

import type { OrgUnitNode } from '@/features/risks/types';

/**
 * Component-mount evidence for `IncidentRegisterFilters`'s active-filter chip
 * row (CLAUDE.md §18.11 "Filtros ativos são visíveis?") — pins that the chip
 * row reflects exactly the filters the caller reports as applied, and that
 * removing one chip calls back with that field cleared, never another.
 */
const { listOrgUnitsMock } = vi.hoisted(() => ({ listOrgUnitsMock: vi.fn() }));

vi.mock('../api', () => ({
  incidentsApi: { listOrgUnits: listOrgUnitsMock },
}));

const orgUnits: OrgUnitNode[] = [
  { id: 'org-1', code: 'ROOT', name: 'PharosGRC', parentId: null, depth: 0, status: 'ACTIVE' },
];

function baseProps() {
  return {
    status: [] as const,
    onStatusChange: vi.fn(),
    severity: [] as const,
    onSeverityChange: vi.fn(),
    orgUnitId: undefined,
    onOrgUnitIdChange: vi.fn(),
    searchValue: '',
    onSearchChange: vi.fn(),
    hasActiveFilters: false,
    activeFilterCount: 0,
    onClearFilters: vi.fn(),
  };
}

describe('IncidentRegisterFilters', () => {
  it('places presentation controls beside the search field', () => {
    listOrgUnitsMock.mockResolvedValue(orgUnits);
    render(
      <IncidentRegisterFilters
        {...baseProps()}
        presentationControls={<button type="button">Ordenar incidentes</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ordenar incidentes' })).toBeVisible();
  });

  it('renders no active-filter chip and no badge count when nothing is applied', () => {
    listOrgUnitsMock.mockResolvedValue(orgUnits);
    render(<IncidentRegisterFilters {...baseProps()} />);

    expect(screen.queryByText(/^Status:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Severidade:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Unidade organizacional:/)).not.toBeInTheDocument();
  });

  it('renders one chip per active filter field, and the badge count matches activeFilterCount', async () => {
    listOrgUnitsMock.mockResolvedValue(orgUnits);
    render(
      <IncidentRegisterFilters
        {...baseProps()}
        status={['OPEN']}
        severity={['CRITICAL', 'HIGH']}
        orgUnitId="org-1"
        hasActiveFilters
        activeFilterCount={3}
      />,
    );

    await waitFor(() => expect(listOrgUnitsMock).toHaveBeenCalled());

    expect(screen.getByText('Status: Aberto')).toBeInTheDocument();
    // Two selected severities collapse to a count chip, never two chips.
    expect(screen.getByText('Severidade (2)')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Unidade organizacional: PharosGRC')).toBeInTheDocument(),
    );
    const filtersToggle = screen.getByRole('button', { name: /Filtros/ });
    expect(filtersToggle).toHaveTextContent('3');
  });

  it('removing the organizational unit chip clears only that field', async () => {
    listOrgUnitsMock.mockResolvedValue(orgUnits);
    const onOrgUnitIdChange = vi.fn();
    const onStatusChange = vi.fn();
    render(
      <IncidentRegisterFilters
        {...baseProps()}
        status={['OPEN']}
        orgUnitId="org-1"
        onOrgUnitIdChange={onOrgUnitIdChange}
        onStatusChange={onStatusChange}
        hasActiveFilters
        activeFilterCount={2}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Unidade organizacional: PharosGRC')).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remover filtro: Unidade organizacional: PharosGRC',
      }),
    );

    expect(onOrgUnitIdChange).toHaveBeenCalledWith(undefined);
    expect(onStatusChange).not.toHaveBeenCalled();
  });

  it('shows the reference-data error banner, with a working retry, when loading organizational units fails', async () => {
    listOrgUnitsMock.mockRejectedValueOnce(new Error('network down'));
    listOrgUnitsMock.mockResolvedValueOnce(orgUnits);
    render(<IncidentRegisterFilters {...baseProps()} />);

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível carregar as opções de filtro.'),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() =>
      expect(
        screen.queryByText('Não foi possível carregar as opções de filtro.'),
      ).not.toBeInTheDocument(),
    );
    expect(listOrgUnitsMock).toHaveBeenCalledTimes(2);
  });
});
