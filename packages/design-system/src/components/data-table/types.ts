/**
 * PharosGRC Design System — `DataTable` shared types (T108).
 *
 * Re-exports the TanStack Table 8 types every caller needs to build a
 * `ColumnDef` array, so a feature module never imports `@tanstack/react-table`
 * directly just to name a type — one dependency edge, not two.
 */
export type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  Row,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

/**
 * `DataTable`'s own chrome text (loading announcement, pagination controls,
 * sort-state announcements). Required, never defaulted inside the
 * component — `packages/design-system` must not depend on `apps/web`'s
 * message catalog (see that catalog's own doc comment), so every caller
 * supplies this from its own pt-BR source (`common.dataTable` in
 * `apps/web`, reused by every module's register screen — T108/SC-011).
 */
export interface DataTableLabels {
  /** Screen-reader announcement while a page of rows is loading. */
  loading: string;
  /** Visible and accessible label for the page-size control. */
  rowsPerPageLabel: string;
  /** Accessible label for the "jump to page" number input. */
  goToPageLabel: string;
  /** Accessible name for the ellipsis button that reveals the "jump to page" input, e.g. "Ir para uma página específica". */
  goToPageToggleLabel: string;
  /** e.g. "1–50 de 12.345" / "Nenhum resultado" — the register's own toolbar already states the total, so this line names the slice, not the whole. */
  resultsSummary: (from: number, to: number, total: number) => string;
  previousPageLabel: string;
  nextPageLabel: string;
  /**
   * Accessible name for one numbered page button in the windowed page
   * control (`PaginationFooter`), e.g. "Ir para a página 4". Replaces the
   * former "Página X de Y" span and first/last-page buttons — the numbered
   * control makes both redundant, since page 1 and the last page are always
   * among the (at most ~7) rendered buttons.
   */
  pageNumberLabel: (page: number) => string;
  /**
   * Screen-reader-only suffixes appended after a sortable column header's
   * visible label, so the accessible name of its sort button announces the
   * current state (e.g. "Título (ordenado de forma crescente)") in addition
   * to the `aria-sort` attribute set on the header cell itself — belt and
   * suspenders, since `aria-sort` support varies across assistive
   * technology.
   */
  sort: {
    ascending: string;
    descending: string;
    none: string;
  };
}
