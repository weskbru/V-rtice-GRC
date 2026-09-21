import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RoleFilterBar } from './role-filter-bar';

import type { RoleFilterBarProps } from './role-filter-bar';

/**
 * PharosGRC — the roles surface's search and filters, as this SCREEN composes
 * them (015-roles-permissions-surface FR-005, FR-005a, NFR-005).
 *
 * `FilterBar`'s own disclosure contract is proved once, for all ten screens
 * that compose it, in `components/design-system-register-chrome.test.tsx`.
 * What is this screen's own — and what is asserted here — is the composition:
 * that the two selects are behind the disclosure, that the chips stay OUTSIDE
 * it so a closed panel never hides which filters are narrowing the list, that
 * the badge and the chips are built from the same three fields, and that the
 * chip labels are the ones the shared builders produce.
 *
 * Everything below is observable behaviour — roles, accessible names,
 * `aria-expanded` — never a class name, so a visual change that keeps the
 * behaviour keeps these green.
 */

const MODULES = [
  { area: 'risk', label: 'Riscos' },
  { area: 'control', label: 'Controles' },
] as const;

function renderBar(overrides: Partial<RoleFilterBarProps> = {}) {
  const props: RoleFilterBarProps = {
    searchValue: '',
    onSearchChange: vi.fn(),
    onClearSearch: vi.fn(),
    type: 'all',
    onTypeChange: vi.fn(),
    module: undefined,
    onModuleChange: vi.fn(),
    availableModules: MODULES,
    hasActiveFilters: false,
    activeFilterCount: 0,
    onClearFilters: vi.fn(),
    ...overrides,
  };
  render(<RoleFilterBar {...props} />);
  return props;
}

function toggle(): HTMLElement {
  return screen.getByRole('button', { name: /^Filtros/ });
}

describe('RoleFilterBar — the filters behind the disclosure', () => {
  it('keeps the search box on screen and the two selects behind the toggle', () => {
    renderBar();

    // Search is never hidden: it is the control a reader reaches for first.
    expect(screen.getByLabelText('Buscar papéis')).toBeInTheDocument();

    expect(screen.queryByRole('combobox', { name: 'Tipo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Módulo' })).not.toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Módulo' })).toBeInTheDocument();
  });

  it('puts both selects inside the panel the toggle actually controls', () => {
    renderBar();
    fireEvent.click(toggle());

    const panelId = toggle().getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId ?? '');
    expect(panel).not.toBeNull();
    expect(within(panel!).getByRole('combobox', { name: 'Tipo' })).toBeInTheDocument();
    expect(within(panel!).getByRole('combobox', { name: 'Módulo' })).toBeInTheDocument();
  });

  it('offers no module control when no loaded role reaches any module', () => {
    renderBar({ availableModules: [] });
    fireEvent.click(toggle());

    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Módulo' })).not.toBeInTheDocument();
  });

  it('states FR-005a beside the module control once a module narrows the list', () => {
    renderBar({ module: 'risk', hasActiveFilters: true, activeFilterCount: 1 });
    fireEvent.click(toggle());

    expect(
      screen.getByText('Mostra os papéis que concedem ao menos uma permissão do módulo.'),
    ).toBeInTheDocument();
  });

  it('does not state FR-005a while every module is included', () => {
    renderBar();
    fireEvent.click(toggle());

    expect(
      screen.queryByText('Mostra os papéis que concedem ao menos uma permissão do módulo.'),
    ).not.toBeInTheDocument();
  });
});

describe('RoleFilterBar — the state a closed panel must not hide', () => {
  it('shows every active filter as a chip while the panel is closed', () => {
    renderBar({
      searchValue: 'auditor',
      type: 'system',
      module: 'risk',
      hasActiveFilters: true,
      activeFilterCount: 3,
    });

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');

    const chips = screen.getByRole('group', { name: 'Filtros ativos' });
    // The exact strings the shared builders compose — `searchChip` for the
    // term, `singleValueChip` for each single-value select.
    expect(within(chips).getByText('Busca: "auditor"')).toBeInTheDocument();
    expect(within(chips).getByText('Tipo: Sistema')).toBeInTheDocument();
    expect(within(chips).getByText('Módulo: Riscos')).toBeInTheDocument();
  });

  it('states how many filter fields are applied on the collapsed toggle', () => {
    renderBar({ type: 'system', hasActiveFilters: true, activeFilterCount: 1 });

    expect(toggle()).toHaveAccessibleName(/1/);
  });

  it('removes exactly one filter from its own chip, leaving the others alone', () => {
    const onTypeChange = vi.fn();
    const onClearSearch = vi.fn();
    const onModuleChange = vi.fn();
    renderBar({
      searchValue: 'auditor',
      type: 'system',
      module: 'risk',
      hasActiveFilters: true,
      activeFilterCount: 3,
      onTypeChange,
      onClearSearch,
      onModuleChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Tipo: Sistema' }));

    expect(onTypeChange).toHaveBeenCalledWith('all');
    expect(onClearSearch).not.toHaveBeenCalled();
    expect(onModuleChange).not.toHaveBeenCalled();
  });

  it('clears the search term through the chip, not through the debounced box', () => {
    const onClearSearch = vi.fn();
    const onSearchChange = vi.fn();
    renderBar({
      searchValue: 'auditor',
      hasActiveFilters: true,
      activeFilterCount: 1,
      onClearSearch,
      onSearchChange,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Busca: "auditor"' }));

    // A debounced `onSearchChange('')` would leave the chip a third of a
    // second behind the click that removed it.
    expect(onClearSearch).toHaveBeenCalledTimes(1);
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it('offers "clear all" beside the chips, with the panel still closed', () => {
    const onClearFilters = vi.fn();
    renderBar({ type: 'custom', hasActiveFilters: true, activeFilterCount: 1, onClearFilters });

    const chips = screen.getByRole('group', { name: 'Filtros ativos' });
    fireEvent.click(within(chips).getByRole('button', { name: 'Limpar filtros' }));

    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders no chip row at all when nothing is filtering the list', () => {
    renderBar();

    expect(screen.queryByRole('group', { name: 'Filtros ativos' })).not.toBeInTheDocument();
  });

  it('never shows a module chip for an area no loaded role reaches', () => {
    // The URL can name an area that the current page of roles does not
    // reach; a chip reading "Módulo: undefined" would be worse than none.
    renderBar({ module: 'compliance', hasActiveFilters: true, activeFilterCount: 1 });

    expect(screen.queryByRole('group', { name: 'Filtros ativos' })?.textContent ?? '').not.toMatch(
      /Módulo/,
    );
  });
});
