import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { common } from '@/lib/messages/common';
import {
  CardGrid,
  ColumnVisibilityMenu,
  FilterBar,
  MultiSelectFilter,
  PaginationFooter,
  ResultsToolbar,
} from '@vertice/design-system/components';

import type { ActiveFilterChip } from '@vertice/design-system/components';

const CHIP_A: ActiveFilterChip = {
  id: 'status',
  label: 'Status: Em tratamento',
  removeLabel: 'Remover filtro: Status: Em tratamento',
  onRemove: () => undefined,
};

describe('FilterBar — collapsible filter disclosure', () => {
  function renderCollapsible(overrides: Partial<React.ComponentProps<typeof FilterBar>> = {}) {
    return render(
      <FilterBar
        label="Filtros do registro de riscos"
        searchLabel="Buscar por código, título ou descrição"
        searchPlaceholder="Buscar riscos por código, título ou descrição…"
        searchValue=""
        onSearchChange={() => undefined}
        collapsible
        filtersToggleLabel="Filtros"
        filtersPanelLabel="Filtros do registro de riscos"
        activeFiltersLabel="Filtros ativos"
        clearFiltersLabel="Limpar filtros"
        {...overrides}
      >
        <button type="button">Status</button>
      </FilterBar>,
    );
  }

  it('keeps the search box reachable by its accessible name with no visible label', () => {
    renderCollapsible();

    expect(screen.getByLabelText('Buscar por código, título ou descrição')).toBeInTheDocument();
  });

  it('uses the compact register surface without changing the default card treatment', () => {
    const { rerender } = renderCollapsible({ variant: 'register' });

    const registerBar = screen.getByRole('search', { name: 'Filtros do registro de riscos' });
    expect(registerBar).toHaveClass(
      'border',
      'border-x-0',
      'border-t-0',
      'bg-transparent',
      'px-0',
      'pb-4',
    );
    expect(registerBar).not.toHaveClass('rounded-lg', 'border-x');

    rerender(
      <FilterBar
        label="Filtros do registro de riscos"
        searchLabel="Buscar por código, título ou descrição"
        searchValue=""
        onSearchChange={() => undefined}
      />,
    );

    const defaultBar = screen.getByRole('search', { name: 'Filtros do registro de riscos' });
    expect(defaultBar).toHaveClass('rounded-lg', 'border', 'bg-card', 'p-4');
  });

  it('keeps presentation controls available while filters are collapsed', () => {
    renderCollapsible({ searchTrailing: <button type="button">Modo de visualização</button> });
    expect(screen.getByRole('button', { name: 'Modo de visualização' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
    expect(screen.getByRole('button', { name: 'Status' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Modo de visualização' })).toBeVisible();
  });

  it('hides the filter controls until the toggle is activated', () => {
    renderCollapsible();

    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
  });

  it('points the toggle at the panel it controls', () => {
    renderCollapsible();

    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    fireEvent.click(toggle);

    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();
    expect(within(panel!).getByRole('button', { name: 'Status' })).toBeInTheDocument();
  });

  it('names a panel that exists in the document while the filters are still closed', () => {
    renderCollapsible();

    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).not.toBeNull();
  });

  it('keeps the closed panel out of sight, out of the tab order and unannounced', () => {
    renderCollapsible({ filtersPanelLabel: 'Filtros do registro de riscos' });

    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!);

    expect(panel).not.toBeVisible();
    expect(
      screen.queryByRole('group', { name: 'Filtros do registro de riscos' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(panel).toBeVisible();
    expect(screen.getByRole('group', { name: 'Filtros do registro de riscos' })).toBe(panel);
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
  });

  it('reveals the same panel element it named while closed, id unchanged', () => {
    renderCollapsible();

    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    const panelId = toggle.getAttribute('aria-controls');
    const panelWhileClosed = document.getElementById(panelId!);

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-controls')).toBe(panelId);
    expect(document.getElementById(panelId!)).toBe(panelWhileClosed);

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(panelId!)).toBe(panelWhileClosed);
    expect(panelWhileClosed).not.toBeVisible();
  });

  it('states how many filters are applied on the collapsed toggle', () => {
    renderCollapsible({ activeFilterCount: 2, hasActiveFilters: true });

    expect(screen.getByRole('button', { name: /^Filtros/ })).toHaveAccessibleName(/2/);
  });

  it('shows active filters as removable chips while the panel stays closed', () => {
    const onRemove = vi.fn();
    renderCollapsible({
      hasActiveFilters: true,
      activeFilterCount: 1,
      activeFilters: [{ ...CHIP_A, onRemove }],
      onClearFilters: () => undefined,
    });

    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.getByText('Status: Em tratamento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Status: Em tratamento' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });

  it('still offers the disclosure when the register has no search box', () => {
    render(
      <FilterBar
        label="Filtros do catálogo de auditorias"
        collapsible
        filtersToggleLabel="Filtros"
        filtersPanelLabel="Filtros do catálogo de auditorias"
      >
        <button type="button">Status</button>
      </FilterBar>,
    );

    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
  });

  function renderCollapsibleNoSearch(
    overrides: Partial<React.ComponentProps<typeof FilterBar>> = {},
  ) {
    return render(
      <FilterBar
        label="Filtros do catálogo de auditorias"
        collapsible
        filtersToggleLabel="Filtros"
        filtersPanelLabel="Filtros do catálogo de auditorias"
        activeFiltersLabel="Filtros ativos"
        clearFiltersLabel="Limpar filtros"
        {...overrides}
      >
        <button type="button">Status</button>
      </FilterBar>,
    );
  }

  it('names a panel that exists in the document while collapsed, with no search box to lean on (F-71)', () => {
    renderCollapsibleNoSearch();

    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();
    expect(panel).not.toBeVisible();
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(document.getElementById(panelId!)).toBe(panel);
    expect(panel).toBeVisible();
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
  });

  it('shows active filters as removable chips while collapsed, with no search box to lean on', () => {
    const onRemove = vi.fn();
    renderCollapsibleNoSearch({
      hasActiveFilters: true,
      activeFilterCount: 1,
      activeFilters: [{ ...CHIP_A, onRemove }],
      onClearFilters: () => undefined,
    });

    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.getByText('Status: Em tratamento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Status: Em tratamento' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });

  it('keeps presentation controls in the slim row when the register has no search box', () => {
    renderCollapsibleNoSearch({
      searchTrailing: <button type="button">Alternar visualização</button>,
    });

    expect(screen.getByRole('button', { name: 'Alternar visualização' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));

    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alternar visualização' })).toBeInTheDocument();
  });

  it('leaves a non-collapsible bar exactly as it was — controls visible, no toggle', () => {
    render(
      <FilterBar
        label="Filtros"
        searchLabel="Buscar"
        searchValue=""
        onSearchChange={() => undefined}
      >
        <button type="button">Status</button>
      </FilterBar>,
    );

    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Filtros/ })).not.toBeInTheDocument();
  });
});

describe('ResultsToolbar', () => {
  it('announces the result count and renders the controls it is given', () => {
    render(
      <ResultsToolbar count="861 riscos">
        <button type="button">Cards</button>
      </ResultsToolbar>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('861 riscos');
    expect(screen.getByRole('button', { name: 'Cards' })).toBeInTheDocument();
  });

  it('says it is loading instead of stating a count it does not have yet', () => {
    render(<ResultsToolbar count="861 riscos" isLoading loadingLabel="Carregando riscos…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Carregando riscos…');
    expect(screen.queryByText('861 riscos')).not.toBeInTheDocument();
  });
});

describe('PaginationFooter', () => {
  function renderFooter(overrides: Partial<React.ComponentProps<typeof PaginationFooter>> = {}) {
    const props = {
      pageIndex: 0,
      pageSize: 50,
      totalRows: 861,
      onPageIndexChange: vi.fn(),
      onPageSizeChange: vi.fn(),
      labels: common.dataTable,
      ...overrides,
    };
    render(<PaginationFooter {...props} />);
    return props;
  }

  it('summarises the current page without repeating the toolbar count', () => {
    renderFooter();

    expect(screen.getByRole('status')).toHaveTextContent('1–50 de 861');
  });

  it('marks the current page and moves to a numbered one', () => {
    const props = renderFooter();

    const current = screen.getByRole('button', { name: 'Ir para a página 1' });
    expect(current).toHaveAttribute('aria-current', 'page');

    fireEvent.click(screen.getByRole('button', { name: 'Ir para a página 3' }));
    expect(props.onPageIndexChange).toHaveBeenCalledWith(2);
  });

  it('changes how many items a page holds', () => {
    const props = renderFooter();

    fireEvent.change(screen.getByLabelText(common.dataTable.rowsPerPageLabel), {
      target: { value: '100' },
    });
    expect(props.onPageSizeChange).toHaveBeenCalledWith(100);
  });

  it('omits the duplicate page-size selector but keeps page navigation when supplied by the caller', () => {
    const props = renderFooter({ showPageSize: false });
    expect(screen.queryByLabelText(common.dataTable.rowsPerPageLabel)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: common.dataTable.nextPageLabel }));
    expect(props.onPageIndexChange).toHaveBeenCalledWith(1);
  });

  it('opens the jump field from the ellipsis and goes to the typed page', () => {
    const props = renderFooter();

    expect(screen.queryByLabelText(common.dataTable.goToPageLabel)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: common.dataTable.goToPageToggleLabel }));

    const input = screen.getByLabelText(common.dataTable.goToPageLabel);
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: '14' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onPageIndexChange).toHaveBeenCalledWith(13);
  });

  it('returns focus to the ellipsis when the jump field is dismissed', () => {
    renderFooter();

    const toggle = screen.getByRole('button', { name: common.dataTable.goToPageToggleLabel });
    fireEvent.click(toggle);
    fireEvent.keyDown(screen.getByLabelText(common.dataTable.goToPageLabel), { key: 'Escape' });

    expect(screen.queryByLabelText(common.dataTable.goToPageLabel)).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('offers no jump control when every page already has a button', () => {
    renderFooter({ totalRows: 120, pageSize: 50 });

    expect(
      screen.queryByRole('button', { name: common.dataTable.goToPageToggleLabel }),
    ).not.toBeInTheDocument();
  });
});

describe('CardGrid', () => {
  const items = [
    { id: 'a', title: 'RSK-2026-0001' },
    { id: 'b', title: 'RSK-2026-0002' },
  ];

  function renderGrid(
    overrides: Partial<React.ComponentProps<typeof CardGrid<(typeof items)[number]>>> = {},
  ) {
    render(
      <CardGrid
        items={items}
        getItemKey={(item) => item.id}
        renderItem={(item) => <article>{item.title}</article>}
        regionLabel="Riscos"
        emptyContent={<p>Nenhum risco encontrado</p>}
        {...overrides}
      />,
    );
  }

  it('renders one list item per record under a named list', () => {
    renderGrid();

    const list = screen.getByRole('list', { name: 'Riscos' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('announces loading in place of the list', () => {
    renderGrid({ isLoading: true, loadingLabel: 'Carregando riscos…' });

    expect(screen.getByRole('status')).toHaveTextContent('Carregando riscos…');
    expect(screen.queryByRole('list', { name: 'Riscos' })).not.toBeInTheDocument();
  });

  it('renders the caller-owned empty content when there is nothing to show', () => {
    renderGrid({ items: [] });

    expect(screen.getByText('Nenhum risco encontrado')).toBeInTheDocument();
  });

  it('replaces the list with the error and its retry action', () => {
    renderGrid({
      error: { title: 'Falha ao carregar' },
      errorAction: <button type="button">Tentar novamente</button>,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Riscos' })).not.toBeInTheDocument();
  });
});

describe('MultiSelectFilter', () => {
  function renderFilter(onChange = vi.fn()) {
    render(
      <MultiSelectFilter
        label="Status"
        options={[
          { value: 'DRAFT', label: 'Rascunho' },
          { value: 'IDENTIFIED', label: 'Identificado' },
        ]}
        selected={['DRAFT']}
        onChange={onChange}
        clearLabel="Limpar"
      />,
    );
    return onChange;
  }

  it('opens its panel, reports how many values are selected and clears them', () => {
    const onChange = renderFilter();

    const trigger = screen.getByRole('button', { name: /Status/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Identificado' }));
    expect(onChange).toHaveBeenCalledWith(['DRAFT', 'IDENTIFIED']);

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('names a panel that exists in the document while it is still closed', () => {
    renderFilter();

    const trigger = screen.getByRole('button', { name: /Status/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const panelId = trigger.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();

    expect(panel).not.toBeVisible();
    expect(screen.queryByRole('checkbox', { name: 'Rascunho' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar' })).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(document.getElementById(panelId!)).toBe(panel);
    expect(panel).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Rascunho' })).toBeInTheDocument();
  });
});

describe('ColumnVisibilityMenu', () => {
  function renderMenu(onChange = vi.fn()) {
    render(
      <ColumnVisibilityMenu
        label="Colunas"
        columns={[
          { id: 'category', label: 'Categoria' },
          { id: 'owner', label: 'Responsável' },
        ]}
        visibility={{ owner: false }}
        onChange={onChange}
      />,
    );
    return onChange;
  }

  it('opens its panel and toggles one column', () => {
    const onChange = renderMenu();

    const trigger = screen.getByRole('button', { name: 'Colunas' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const categoria = screen.getByRole('checkbox', { name: 'Categoria' });
    expect(categoria).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Responsável' })).not.toBeChecked();

    fireEvent.click(categoria);
    expect(onChange).toHaveBeenCalledWith({ owner: false, category: false });
  });

  it('names a panel that exists in the document while it is still closed', () => {
    renderMenu();

    const trigger = screen.getByRole('button', { name: 'Colunas' });
    const panelId = trigger.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();
    expect(panel).not.toBeVisible();
    expect(screen.queryByRole('checkbox', { name: 'Categoria' })).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(document.getElementById(panelId!)).toBe(panel);
    expect(panel).toBeVisible();
  });
});
