import {
  CardGrid,
  ColumnVisibilityMenu,
  FilterBar,
  MultiSelectFilter,
  PaginationFooter,
  ResultsToolbar,
} from '@pharos/design-system/components';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ActiveFilterChip } from '@pharos/design-system/components';

import { common } from '@/lib/messages/common';

/**
 * PharosGRC — direct evidence for the register/list chrome of
 * `packages/design-system` (CLAUDE.md §18.3).
 *
 * These five components are the shared exploration frame every GRC register
 * screen composes — and, until this file, the only proof any of them worked
 * was indirect, through whichever feature happened to render them. That is
 * exactly the "guard that passes without protecting anything" this project
 * has already paid for more than once: a change to `FilterBar`'s disclosure
 * or to `PaginationFooter`'s page window reaches Risks, Controls, Assets,
 * Processes, Audits, Incidents, Problems, Reports, Compliance and
 * Administration at the same instant, with nothing between the edit and ten
 * screens.
 *
 * Everything asserted here is behaviour a user or a screen reader can
 * observe — roles, accessible names, `aria-expanded`/`aria-controls`,
 * focus — never a class name or a DOM shape, so a visual redesign that
 * keeps the behaviour keeps these tests green.
 */

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

  /**
   * F-71. The toggle's `aria-controls` must name an element that is actually
   * in the document, *while the panel is closed* — not only after it opens.
   *
   * This is the guard for a production-visible defect, not a tidiness rule.
   * The panel used to be created on the click, which meant two things at
   * once: with the panel closed the reference dangled on every load in every
   * engine (axe tolerates that only through its documented
   * `aria-expanded="false"` exception, which is why no gate ever reported
   * it), and — because React 19's `useId` is positional and shifts when the
   * streamed HTML of a `<Suspense>` route races hydration, and because React
   * does not patch an attribute mismatch — the button kept the *server's* id
   * while the newly-created panel took the *client's*. Opening the panel
   * then produced a dangling `aria-controls` with `aria-expanded="true"`:
   * `aria-valid-attr-value`, impact critical, measured in a production build
   * on Firefox in 3 of 4 measurements.
   *
   * Asserting resolution while closed is what catches a regression to the
   * mount-on-click shape, because that shape cannot satisfy it.
   */
  it('names a panel that exists in the document while the filters are still closed', () => {
    renderCollapsible();

    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const panelId = toggle.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).not.toBeNull();
  });

  /**
   * The other half of the same fix: keeping the panel in the document must
   * not put its controls in front of anyone while it is closed. `hidden`
   * (`display: none`) is what takes the subtree out of the tab order and out
   * of the accessibility tree — an `aria-hidden` or an off-screen clip would
   * leave the filter controls tabbable, which would be a worse defect than
   * the one being fixed.
   */
  it('keeps the closed panel out of sight, out of the tab order and unannounced', () => {
    renderCollapsible({ filtersPanelLabel: 'Filtros do registro de riscos' });

    const toggle = screen.getByRole('button', { name: /^Filtros/ });
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!);

    expect(panel).not.toBeVisible();
    // Not exposed to assistive technology: neither the group itself…
    expect(
      screen.queryByRole('group', { name: 'Filtros do registro de riscos' }),
    ).not.toBeInTheDocument();
    // …nor anything inside it.
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(panel).toBeVisible();
    expect(screen.getByRole('group', { name: 'Filtros do registro de riscos' })).toBe(panel);
    expect(screen.getByRole('button', { name: 'Status' })).toBeInTheDocument();
  });

  /**
   * Opening must reveal the panel the button already named, never replace it
   * with a new element — that identity is precisely what stops the two ids
   * from being produced by two different render passes.
   */
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

    // The panel is closed…
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
    // …and the user can still see, and drop, exactly which filter narrowed the list.
    expect(screen.getByText('Status: Em tratamento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Status: Em tratamento' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });

  /**
   * The audit engagements catalog has no text search — `GET /audits` accepts
   * no `q` — and would otherwise have ended up with filters behind a button
   * that never rendered.
   */
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

  /**
   * The no-search collapsible disposition (Relatórios, Auditoria, Planos de
   * Ação — no `q`/text-search parameter in their contract). Before this
   * fix, the shared bordered card that normally holds the search box and
   * the toggle together wrapped nothing but a lone button, rendering as a
   * ~74px empty box on `/reports`/`/audits`/`/actions`. This does not
   * assert class names or box dimensions (a class-name assertion would not
   * survive a redesign that keeps the behaviour) — it asserts the same
   * three behavioural guarantees the with-search tests above assert for
   * their own disposition: the panel is a real, F-71-safe element while
   * collapsed, the chips stay reachable while collapsed, and opening
   * reveals the controls.
   */
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

    // The panel is closed…
    expect(screen.queryByRole('button', { name: 'Status' })).not.toBeInTheDocument();
    // …and the user can still see, and drop, exactly which filter narrowed the list.
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

  /**
   * The jump field used to sit in the footer permanently, competing with the
   * numbered pages for the same attention. It is now behind the ellipsis
   * that already stands for "there are pages here you cannot click" — the
   * capability is unchanged, only its resting state is quiet.
   */
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

    // A live region is announced by its CONTENT, not by a name — so that is
    // what this asserts, rather than an `aria-label` a screen reader would
    // then read instead of the text.
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

  /**
   * F-71, the half no gate reports. This trigger carries `aria-haspopup`,
   * and axe's `aria-valid-attr-value` rule downgrades a missing
   * `aria-controls` target to "needs review" for ANY element carrying that
   * attribute — so a dangling reference here is invisible to every
   * accessibility scan this project runs. It became reachable the moment
   * `FilterBar` stopped unmounting its collapsed panel: these triggers then
   * started arriving in the server HTML, where a shifted `useId` leaves the
   * trigger holding the server id and a click-created panel holding the
   * client one. Measured on a production build before this guard existed:
   * 22 of 32 Firefox loads of /risks, all four triggers each.
   *
   * Asserting the target exists while CLOSED is what pins the fix, because
   * the mount-on-click shape cannot satisfy it.
   */
  it('names a panel that exists in the document while it is still closed', () => {
    renderFilter();

    const trigger = screen.getByRole('button', { name: /Status/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const panelId = trigger.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel).not.toBeNull();

    // …without putting its options in front of anyone, or in the tab order.
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

  /** Same guard, same reason as `MultiSelectFilter`'s above (F-71). */
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
