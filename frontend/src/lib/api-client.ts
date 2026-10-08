import { errors } from './messages/errors';

const API_BASE_PATH = '/api/v1';

function synthesizedTitle(status: number): string {
  return (errors.httpStatusTitle as Record<number, string>)[status] ?? errors.requestFailedTitle;
}

export interface ApiProblem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  correlationId?: string;
  errors?: readonly { field?: string; message: string }[];
  currentVersion?: number;
  currentStatus?: string;
  modifiedAt?: string;
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

export class ApiError extends Error {
  readonly problem: ApiProblem;

  constructor(problem: ApiProblem) {
    super(problem.title);
    this.name = 'ApiError';
    this.problem = problem;
  }
}

type UnauthorizedHandler = (problem: ApiProblem) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

type PasswordChangeRequiredHandler = (problem: ApiProblem) => void;

let passwordChangeRequiredHandler: PasswordChangeRequiredHandler | null = null;

export function setPasswordChangeRequiredHandler(
  handler: PasswordChangeRequiredHandler | null,
): void {
  passwordChangeRequiredHandler = handler;
}

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

  return { title: synthesizedTitle(response.status), status: response.status };
}

export interface ApiRequestInit extends Omit<RequestInit, 'body' | 'method'> {
  body?: unknown;
  skipUnauthorizedHandler?: boolean;
}

export interface ApiResponseWithMeta<TResponse> {
  data: TResponse;
  etag: string | null;
}

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
    ...rest,
    method,
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

async function requestFormWithMeta<TResponse>(
  path: string,
  formData: FormData,
  init: Omit<ApiRequestInit, 'body'> = {},
): Promise<ApiResponseWithMeta<TResponse>> {
  const { headers, skipUnauthorizedHandler, ...rest } = init;

  const response = await fetch(`${API_BASE_PATH}${path}`, {
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

  getWithMeta: <TResponse>(path: string, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'GET', init),
  postWithMeta: <TResponse>(path: string, body?: unknown, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'POST', { ...init, body }),
  putWithMeta: <TResponse>(path: string, body?: unknown, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'PUT', { ...init, body }),
  patchWithMeta: <TResponse>(path: string, body?: unknown, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'PATCH', { ...init, body }),
  deleteWithMeta: <TResponse>(path: string, init?: ApiRequestInit) =>
    requestWithMeta<TResponse>(path, 'DELETE', init),

  postFormWithMeta: <TResponse>(
    path: string,
    formData: FormData,
    init?: Omit<ApiRequestInit, 'body'>,
  ) => requestFormWithMeta<TResponse>(path, formData, init),
};
