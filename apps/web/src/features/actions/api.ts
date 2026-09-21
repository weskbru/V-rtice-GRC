/**
 * PharosGRC frontend — Action API wrapper (T056, 002-shared-grc-foundation,
 * US2). A thin, typed layer over `apiClient`, mirroring `features/evidence
 * /api.ts`'s own shape. `Action` carries no optimistic-concurrency field
 * (data-model.md §4) — no `ETag`/`If-Match` handling needed here.
 */
import { apiClient } from '@/lib/api-client';

import type {
  Action,
  ActionPage,
  AuditEvent,
  CreateActionRequest,
  ListActionsQuery,
  Page,
  TransitionActionRequest,
  UpdateActionRequest,
  UserRef,
} from './types';

/** Builds `GET /actions`'s query string, omitting any filter the caller
 * did not set — the same convention `risksApi`'s own
 * `buildRegisterQueryString` establishes. */
function buildListQueryString(query: ListActionsQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.status) params.set('status', query.status);
  if (query.responsibleUserId) params.set('responsibleUserId', query.responsibleUserId);
  if (query.originType) params.set('originType', query.originType);
  if (query.originId) params.set('originId', query.originId);
  if (query.overdue !== undefined) params.set('overdue', String(query.overdue));
  return params.toString();
}

export const actionsApi = {
  async listActions(query: ListActionsQuery): Promise<ActionPage> {
    return apiClient.get<ActionPage>(`/actions?${buildListQueryString(query)}`);
  },

  async getAction(actionId: string): Promise<Action> {
    return apiClient.get<Action>(`/actions/${actionId}`);
  },

  async createAction(body: CreateActionRequest): Promise<Action> {
    return apiClient.post<Action>('/actions', body);
  },

  async updateAction(actionId: string, body: UpdateActionRequest): Promise<Action> {
    return apiClient.patch<Action>(`/actions/${actionId}`, body);
  },

  async transitionAction(actionId: string, body: TransitionActionRequest): Promise<Action> {
    return apiClient.post<Action>(`/actions/${actionId}/transitions`, body);
  },

  /**
   * `GET /actions/{actionId}/audit-events` — mirrors `risksApi
   * .listAuditEvents`'s own contract exactly (`features/risks/api.ts`),
   * scoped to `Action` instead of `Risk`. As of this writing (008/009's
   * successor work), this route is being built by a separate, concurrent
   * task alongside this one and may not exist yet in a given environment —
   * `ActionAuditSection` (the only caller) handles a `404`/`403` from this
   * call explicitly rather than assuming the route is live.
   */
  listActionAuditEvents(
    actionId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<AuditEvent>> {
    return apiClient.get<Page<AuditEvent>>(
      `/actions/${actionId}/audit-events?page=${page}&pageSize=${pageSize}`,
    );
  },

  // -------------------------------------------------------------------
  // Reference data for `ActionEditForm` — this module's own copy of the
  // shared `/users` lookup, mirroring `incidentsApi.listUsers`/`problemsApi
  // .listUsers`'s own doc comment (each business module declares its own,
  // per CLAUDE.md §2/§4 — never a cross-module import of another feature's
  // API client).
  // -------------------------------------------------------------------

  /**
   * `GET /users?q=` — searches the directory server-side (S-10: a fixed
   * `pageSize=100` with no search silently hid every user past the first
   * page; this project's own development database already has more than
   * 100). `q` empty returns the first page unfiltered, exactly like before
   * the fix, so `UserPicker`'s own "load a first page on open" behaviour
   * still works with no query typed yet.
   */
  async searchUsers(q: string): Promise<{ data: readonly UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },
};
