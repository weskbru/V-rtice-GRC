/**
 * PharosGRC typed API client (T047).
 *
 * ADR-014 (single origin): every request targets a *relative* `/api/v1/...`
 * path — never an absolute/cross-origin URL — so it is proxied by the
 * Next.js rewrite configured in `next.config.ts` (T048) and the session
 * cookie stays first-party. `credentials: 'include'` is set on every request
 * so the httpOnly session cookie is always sent, including from Server
 * Components / Route Handlers forwarding the incoming request's cookie.
 *
 * ADR-009 (errors): failed responses are parsed as RFC 9457
 * `application/problem+json` and normalized into `ApiProblem` — a narrow,
 * UI-safe shape (title, detail, correlationId, field errors). Anything else
 * a server might put on an error body (stack traces, SQL fragments, internal
 * identifiers) is never part of this type and is never read from the
 * response, so it cannot leak into the UI even if a server bug ever
 * produced it (FR-107, FR-108, SC-010) — see `ErrorState` in
 * `@pharos/design-system`, which renders exactly this shape.
 *
 * ADR-003 (authorization is server-side only): this client never inspects
 * or caches permissions — it only ever forwards whatever the server decided
 * and reports the resulting status/problem back to the caller.
 */

import { errors } from './messages/errors';

const API_BASE_PATH = '/api/v1';

/** Best-effort pt-BR title when this client itself must synthesize one — never used to override a title the server already sent. */
function synthesizedTitle(status: number): string {
  return (errors.httpStatusTitle as Record<number, string>)[status] ?? errors.requestFailedTitle;
}

/** The UI-safe subset of an RFC 9457 problem+json body (ADR-009). */
export interface ApiProblem {
  /** A URI identifying the problem type. Optional — many endpoints omit it. */
  type?: string;
  /** Short, human-readable summary of the problem. */
  title: string;
  /** HTTP status code, duplicated from the response for convenience. */
  status: number;
  /** Human-readable explanation specific to this occurrence. Never a stack trace or raw exception text (ADR-009 guarantees the server-side exception filter enforces this). */
  detail?: string;
  /** Support-facing correlation id the user can quote — not an internal identifier (see ErrorState's doc comment for why this is safe to display). */
  correlationId?: string;
  /** Field-level validation errors, when `status` is 422/400. */
  errors?: readonly { field?: string; message: string }[];
  /**
   * Present only on a `409` optimistic-locking conflict (ADR-013,
   * `VersionConflictProblem` in `risks.openapi.yaml`) — the resource's
   * current `version`, to be echoed in the retried `If-Match`. Never present
   * otherwise.
   */
  currentVersion?: number;
  /** Present alongside `currentVersion` on a `409` — the resource's current lifecycle status, e.g. `RiskStatus`. */
  currentStatus?: string;
  /** Present alongside `currentVersion` on a `409` — when the conflicting write happened. */
  modifiedAt?: string;
  /** Present alongside `currentVersion` on a `409` — who made the conflicting write. Only `id`/`fullName`, the same UI-safe subset as every other user reference in this client. */
  modifiedBy?: { id: string; fullName: string };
}

function isModifiedByLike(value: unknown): value is { id: string; fullName: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).fullName === 'string'
  );
}

/** Thrown for every non-2xx/non-204 response. Always carries a normalized `ApiProblem` — never a raw `Response` or parsed server body. */
export class ApiError extends Error {
  readonly problem: ApiProblem;

  constructor(problem: ApiProblem) {
    super(problem.title);
    this.name = 'ApiError';
    this.problem = problem;
  }
}

/**
 * Session-expiry seam (T077).
 *
 * ADR-002: session revocation/expiry is discovered on the *next* request
 * (there is no client-side token to introspect), so a 401 arriving on any
 * call is the only signal the UI ever gets. `SessionExpiredDialog`
 * (`src/components/shell/session-expired-dialog.tsx`) registers itself here
 * once, inside the authenticated shell, and on a 401 opens an in-place
 * re-authentication prompt rather than navigating anywhere — the page the
 * user was on, and every value in every field on it, is never unmounted, so
 * nothing the user typed is lost (FR-016). Choosing "sign in as someone
 * else" from that prompt is the only path that actually navigates to
 * `/login`, and that is an explicit user choice to abandon the page, not
 * something this client decides on their behalf.
 */
type UnauthorizedHandler = (problem: ApiProblem) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/**
 * Mandatory-password-change seam (S-01, API-side `MandatoryPasswordChangeGuard`).
 *
 * The normal path never needs this: `login-form.tsx` and
 * `session-expired-dialog.tsx` already read `mustChangePassword` off the
 * login response itself and navigate to `/profile?mustChangePassword=true`
 * directly. This seam exists for the case neither of those covers — the
 * user is ALREADY on some other authenticated page (a stale tab, browser
 * back/forward, a bookmark) when their session turns out to have a pending
 * mandatory change, and that page's own data call is the first thing to
 * discover it. Without this seam that call would fail with a generic,
 * unexplained 403 rendered by whatever `ErrorState` the page happens to
 * show — technically correct, but not what CLAUDE.md §18's "never mask an
 * error" standard asks for here: the right response to THIS specific 403
 * is a redirect to the screen that actually resolves it, not a dead end.
 * `PasswordChangeRequiredRedirect` (`src/components/shell/`) registers
 * itself here, mirroring `SessionExpiredDialog`'s own registration pattern
 * for the 401 seam above.
 */
type PasswordChangeRequiredHandler = (problem: ApiProblem) => void;

let passwordChangeRequiredHandler: PasswordChangeRequiredHandler | null = null;

export function setPasswordChangeRequiredHandler(
  handler: PasswordChangeRequiredHandler | null,
): void {
  passwordChangeRequiredHandler = handler;
}

/** `problem.type` for `PasswordChangeRequiredDomainError`
 * (`apps/api/src/infrastructure/http/problem-details.filter.ts`). Matched
 * by suffix, not the full URL, so this client does not need to track the
 * server's `PROBLEM_TYPE_BASE` host verbatim. */
const PASSWORD_CHANGE_REQUIRED_TYPE_SUFFIX = '/password-change-required';

function isPasswordChangeRequiredProblem(problem: ApiProblem): boolean {
  return (
    problem.status === 403 &&
    (problem.type?.endsWith(PASSWORD_CHANGE_REQUIRED_TYPE_SUFFIX) ?? false)
  );
}

function isProblemJsonContentType(contentType: string | null): boolean {
  return contentType?.includes('application/problem+json') ?? false;
}

function isJsonContentType(contentType: string | null): boolean {
  return contentType?.includes('application/json') ?? false;
}

async function parseProblem(response: Response): Promise<ApiProblem> {
  const contentType = response.headers.get('content-type');

  if (isProblemJsonContentType(contentType)) {
    // TODO(T205): once packages/api-types is generated from a populated
    // apps/api/openapi.json, replace this structural cast with the
    // generated `components['schemas']['ProblemDetails']` (or equivalent)
    // type so a contract change is caught at compile time.
    const body = (await response.json().catch(() => ({}))) as Partial<ApiProblem>;
    return {
      title: typeof body.title === 'string' ? body.title : synthesizedTitle(response.status),
      status: response.status,
      ...(typeof body.type === 'string' ? { type: body.type } : {}),
      ...(typeof body.detail === 'string' ? { detail: body.detail } : {}),
      ...(typeof body.correlationId === 'string' ? { correlationId: body.correlationId } : {}),
      ...(Array.isArray(body.errors) ? { errors: body.errors } : {}),
      ...(typeof body.currentVersion === 'number' ? { currentVersion: body.currentVersion } : {}),
      ...(typeof body.currentStatus === 'string' ? { currentStatus: body.currentStatus } : {}),
      ...(typeof body.modifiedAt === 'string' ? { modifiedAt: body.modifiedAt } : {}),
      ...(isModifiedByLike(body.modifiedBy) ? { modifiedBy: body.modifiedBy } : {}),
    };
  }

  // Not a problem+json body — e.g. a proxy/infra failure before the API ran.
  // Deliberately not read as text: an arbitrary error page or stack trace
  // must never reach the UI (FR-107, FR-108).
  return { title: synthesizedTitle(response.status), status: response.status };
}

export interface ApiRequestInit extends Omit<RequestInit, 'body' | 'method'> {
  /** JSON-serializable request body. Sets Content-Type: application/json automatically. */
  body?: unknown;
  /**
   * Opt out of the session-expiry seam for this one call (T077). Set this on
   * every call where a 401 is an *expected, meaningful* outcome the caller
   * already handles inline — `POST /auth/login` (wrong credentials),
   * `POST /auth/me/password` (wrong current password — indistinguishable by
   * contract from an expired session, so the form must own that message),
   * and `POST /auth/logout` (already-gone session is not a session-expiry
   * event). Without this flag every other 401 is assumed to mean "the
   * session died mid-use" and reaches `setUnauthorizedHandler`.
   */
  skipUnauthorizedHandler?: boolean;
}

/** The parsed body plus the subset of response metadata a caller occasionally needs (ADR-013's `ETag`). Kept narrow for the same reason `ApiProblem` is narrow — nothing else from a `Response` is ever threaded through. */
export interface ApiResponseWithMeta<TResponse> {
  data: TResponse;
  /** The `ETag` response header verbatim (e.g. `"7"`), or `null` when absent. Echo it back in `If-Match` on the next mutation of the same resource (ADR-013). */
  etag: string | null;
}

/** Shared response handling for every request shape below (JSON body or `FormData`) — parses an error into `ApiError`, fires the session-expiry seam on an unhandled 401, and otherwise returns the parsed body plus `ETag` (ADR-013). */
async function handleResponse<TResponse>(
  response: Response,
  skipUnauthorizedHandler: boolean | undefined,
): Promise<ApiResponseWithMeta<TResponse>> {
  if (!response.ok) {
    const problem = await parseProblem(response);
    if (response.status === 401 && !skipUnauthorizedHandler) {
      unauthorizedHandler?.(problem);
    }
    if (isPasswordChangeRequiredProblem(problem)) {
      passwordChangeRequiredHandler?.(problem);
    }
    throw new ApiError(problem);
  }

  const etag = response.headers.get('etag');

  if (response.status === 204) {
    return { data: undefined as TResponse, etag };
  }

  const contentType = response.headers.get('content-type');
  if (isJsonContentType(contentType)) {
    return { data: (await response.json()) as TResponse, etag };
  }

  return { data: undefined as TResponse, etag };
}

async function requestWithMeta<TResponse>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  init: ApiRequestInit = {},
): Promise<ApiResponseWithMeta<TResponse>> {
  const { body, headers, skipUnauthorizedHandler, ...rest } = init;

  const response = await fetch(`${API_BASE_PATH}${path}`, {
    // Platform default HTTP caching (`cache` unset -> the browser's normal
    // heuristics) applies here. The previous revision of this file forced
    // `cache: 'no-store'` on EVERY request, in every module, to work around
    // a server-side defect: some GET endpoints (`Requirement`, `Control`)
    // set an `ETag` equal to their optimistic-lock `version` while the
    // response body carried state derived fresh on every read
    // (`complianceState`, `effectiveness`) and NOT reflected in that
    // `version` — a stale `ETag` a real HTTP cache would keep trusting
    // forever. That was fixed at the source instead: those specific GET
    // handlers now send their own `Cache-Control: no-store` and no longer
    // set a version-based `ETag` at all (see
    // `apps/api/src/modules/compliance/presentation/requirement.controller.ts`'s
    // and `apps/api/src/modules/controls/presentation/control.controller.ts`'s
    // `findById`/`list` doc comments for the full account). Blanket
    // `no-store` here would only mask that one symptom for this one
    // browser client — it does nothing for a proxy or any other consumer,
    // and disables real HTTP caching platform-wide for every endpoint that
    // never had this problem (`Framework`, `FrameworkVersion`, `Risk`,
    // whose own `ETag` genuinely tracks everything its GET body renders).
    ...rest,
    method,
    // ADR-014: same-origin only — this path is always relative, proxied by
    // next.config.ts, so the session's httpOnly cookie is sent as first-party.
    credentials: 'include',
    headers: {
      Accept: 'application/json, application/problem+json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  return handleResponse<TResponse>(response, skipUnauthorizedHandler);
}

/**
 * Multipart form submission — the one exception to every other method's
 * JSON body, needed for `POST /attachments` (`multipart/form-data` per its
 * contract). Deliberately never sets a `Content-Type` header itself: the
 * browser must generate the multipart boundary from the actual `FormData`
 * it is given, and overriding that would silently corrupt the request body.
 */
async function requestFormWithMeta<TResponse>(
  path: string,
  formData: FormData,
  init: Omit<ApiRequestInit, 'body'> = {},
): Promise<ApiResponseWithMeta<TResponse>> {
  const { headers, skipUnauthorizedHandler, ...rest } = init;

  const response = await fetch(`${API_BASE_PATH}${path}`, {
    // No `cache` override — see `requestWithMeta`'s own comment above for
    // why this file no longer forces one. Doubly moot here: a `POST` is
    // never stored by a browser HTTP cache regardless.
    ...rest,
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json, application/problem+json',
      ...headers,
    },
    body: formData,
  });

  return handleResponse<TResponse>(response, skipUnauthorizedHandler);
}

async function request<TResponse>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  init: ApiRequestInit = {},
): Promise<TResponse> {
  const { data } = await requestWithMeta<TResponse>(path, method, init);
  return data;
}

/**
 * Typed, same-origin API client. Every method returns the parsed JSON body
 * typed as `TResponse` (supply the type from `@pharos/api-types` once T205
 * generates it for the endpoint you are calling) or throws `ApiError`.
 *
 * @example
 * ```ts
 * // Until @pharos/api-types exposes this operation's response schema
 * // (T205), name a narrow local type at the call site rather than `any`:
 * interface RiskListResponse { data: RiskSummary[]; total: number }
 * const risks = await apiClient.get<RiskListResponse>('/risks?page=1');
 * ```
 */
export const apiClient = {
  get: <TResponse>(path: string, init?: ApiRequestInit) => request<TResponse>(path, 'GET', init),
  post: <TResponse>(path: string, body?: unknown, init?: ApiRequestInit) =>
    request<TResponse>(path, 'POST', { ...init, body }),
  put: <TResponse>(path: string, body?: unknown, init?: ApiRequestInit) =>
    request<TResponse>(path, 'PUT', { ...init, body }),
  patch: <TResponse>(path: string, body?: unknown, init?: ApiRequestInit) =>
    request<TResponse>(path, 'PATCH', { ...init, body }),
  delete: <TResponse>(path: string, init?: ApiRequestInit) =>
    request<TResponse>(path, 'DELETE', init),

  /**
   * Same as `get`, plus the response's `ETag` (ADR-013). Use this for
   * `GET /risks/{id}` and any other endpoint whose `version` a subsequent
   * mutation must echo back in `If-Match`.
   */
  getWithMeta: <TResponse>(path: string, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'GET', init),
  postWithMeta: <TResponse>(path: string, body?: unknown, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'POST', { ...init, body }),
  putWithMeta: <TResponse>(path: string, body?: unknown, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'PUT', { ...init, body }),
  patchWithMeta: <TResponse>(path: string, body?: unknown, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'PATCH', { ...init, body }),
  /**
   * Same as `delete`, plus the response's `ETag` — needed by an unlink
   * (`DELETE /risks/{riskId}/controls|processes|assets/{linkId}`), which
   * returns `204` with the risk's NEW `ETag` (ADR-013: unlinking is a
   * mutation of the risk aggregate, so its shared `version` still advances
   * — `risk-repository.port.ts`'s `touchVersion`).
   */
  deleteWithMeta: <TResponse>(path: string, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'DELETE', init),

  /**
   * `POST` with a `multipart/form-data` body plus the response's `ETag`
   * (used only by `POST /attachments`, per its contract's `requestBody`).
   * Never JSON-encodes `formData` — see `requestFormWithMeta`'s own doc
   * comment for why the browser must own the `Content-Type` header here.
   */
  postFormWithMeta: <TResponse>(
    path: string,
    formData: FormData,
    init?: Omit<ApiRequestInit, 'body'>,
  ) => requestFormWithMeta<TResponse>(path, formData, init),
};
