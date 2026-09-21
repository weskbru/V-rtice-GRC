/**
 * Shared kernel — pagination primitives (T020).
 *
 * ADR-009 fixes offset pagination (`page`, `pageSize`) with a capped page
 * size (FR-086: no endpoint may return an unbounded result set) and a
 * visible `total` count. This module owns the single definition of that
 * cap so no endpoint can accidentally define its own, larger one.
 */

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;
export const MIN_PAGE = 1;

export interface PageRequest {
  /** 1-based page number. */
  readonly page: number;
  /** Rows per page, always within `[MIN_PAGE_SIZE, MAX_PAGE_SIZE]`. */
  readonly pageSize: number;
}

export interface RawPageRequest {
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * Normalizes untrusted `page`/`pageSize` input (typically already parsed
 * from query-string numbers by the presentation layer's DTO) into a
 * `PageRequest` that is safe to hand to a repository — never below the
 * minimum, never above the cap, never fractional.
 */
export function createPageRequest(input: RawPageRequest = {}): PageRequest {
  const page = clampInteger(input.page, MIN_PAGE, Number.MAX_SAFE_INTEGER, MIN_PAGE);
  const pageSize = clampInteger(input.pageSize, MIN_PAGE_SIZE, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);

  return { page, pageSize };
}

/** Pure conversion to a SQL-style offset/limit pair — no ORM dependency. */
export function toOffsetLimit(request: PageRequest): { offset: number; limit: number } {
  return {
    offset: (request.page - 1) * request.pageSize,
    limit: request.pageSize,
  };
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  const integer = Math.trunc(value);

  return Math.min(Math.max(integer, min), max);
}
