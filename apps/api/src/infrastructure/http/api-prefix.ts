/**
 * The API's URI version prefix (ADR-009: `/api/v1/...`). Defined once so
 * `main.ts` (the real running app) and the OpenAPI generation/check scripts
 * (T025) apply the exact same prefix — otherwise the generated document's
 * paths would not match the routes the running API actually serves.
 */
export const API_GLOBAL_PREFIX = 'api/v1';
