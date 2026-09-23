export type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  Row,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';

export interface DataTableLabels {
  loading: string;
  rowsPerPageLabel: string;
  goToPageLabel: string;
  goToPageToggleLabel: string;
  resultsSummary: (from: number, to: number, total: number) => string;
  previousPageLabel: string;
  nextPageLabel: string;
  pageNumberLabel: (page: number) => string;
  sort: {
    ascending: string;
    descending: string;
    none: string;
  };
}
