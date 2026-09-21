/**
 * Shared kernel — pagination response envelope (T020). See page-request.ts.
 *
 * ADR-009 requires a visible `total` count (offset pagination was chosen
 * over cursor pagination specifically so the register can show a total and
 * support jump-to-page). `totalPages` is derived, never stored, so it can
 * never disagree with `total`/`pageSize`.
 */
import type { PageRequest } from './page-request';

export interface PageResponse<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export function createPageResponse<T>(
  items: readonly T[],
  request: PageRequest,
  total: number,
): PageResponse<T> {
  return {
    items,
    page: request.page,
    pageSize: request.pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / request.pageSize),
  };
}
