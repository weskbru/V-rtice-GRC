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

  listActionAuditEvents(
    actionId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<AuditEvent>> {
    return apiClient.get<Page<AuditEvent>>(
      `/actions/${actionId}/audit-events?page=${page}&pageSize=${pageSize}`,
    );
  },

  async searchUsers(q: string): Promise<{ data: readonly UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },
};
