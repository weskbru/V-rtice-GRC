export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;
export const MIN_PAGE = 1;

export interface PageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface RawPageRequest {
  readonly page?: number;
  readonly pageSize?: number;
}

export function createPageRequest(input: RawPageRequest = {}): PageRequest {
  const page = clampInteger(input.page, MIN_PAGE, Number.MAX_SAFE_INTEGER, MIN_PAGE);
  const pageSize = clampInteger(input.pageSize, MIN_PAGE_SIZE, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);

  return { page, pageSize };
}

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
