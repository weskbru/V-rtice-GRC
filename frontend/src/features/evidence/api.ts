import { apiClient } from '@/lib/api-client';

import type {
  CreateEvidenceRequest,
  Evidence,
  EvidenceLink,
  EvidencePage,
  EvidenceSubjectType,
  LinkEvidenceRequest,
  UpdateEvidenceRequest,
} from './types';
import type { Attachment, CollaborationEntityType, Page, UserRef } from '@/features/risks/types';

export const evidenceApi = {
  async listBySubject(subjectType: EvidenceSubjectType, subjectId: string): Promise<EvidencePage> {
    return apiClient.get<EvidencePage>(
      `/evidence?subjectType=${subjectType}&subjectId=${subjectId}&pageSize=100`,
    );
  },

  async getEvidence(evidenceId: string): Promise<Evidence> {
    return apiClient.get<Evidence>(`/evidence/${evidenceId}`);
  },

  async createEvidence(body: CreateEvidenceRequest): Promise<Evidence> {
    return apiClient.post<Evidence>('/evidence', body);
  },

  async updateEvidence(evidenceId: string, body: UpdateEvidenceRequest): Promise<Evidence> {
    return apiClient.patch<Evidence>(`/evidence/${evidenceId}`, body);
  },

  async archiveEvidence(evidenceId: string): Promise<Evidence> {
    return apiClient.post<Evidence>(`/evidence/${evidenceId}/archive`);
  },

  async listLinks(evidenceId: string, includeUnlinked = false): Promise<readonly EvidenceLink[]> {
    return apiClient.get<readonly EvidenceLink[]>(
      `/evidence/${evidenceId}/links?includeUnlinked=${String(includeUnlinked)}`,
    );
  },

  async linkEvidence(evidenceId: string, body: LinkEvidenceRequest): Promise<EvidenceLink> {
    return apiClient.post<EvidenceLink>(`/evidence/${evidenceId}/links`, body);
  },

  async unlinkEvidence(evidenceId: string, linkId: string): Promise<EvidenceLink> {
    return apiClient.post<EvidenceLink>(`/evidence/${evidenceId}/links/${linkId}/unlink`);
  },

  async searchUsers(q: string): Promise<{ data: readonly UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  async uploadAttachment(evidenceId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.set('entityType', 'EVIDENCE' satisfies CollaborationEntityType);
    formData.set('entityId', evidenceId);
    formData.set('file', file);
    const { data } = await apiClient.postFormWithMeta<Attachment>('/attachments', formData);
    return data;
  },

  async listAttachments(
    evidenceId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<Attachment>> {
    return apiClient.get<Page<Attachment>>(
      `/attachments?entityType=EVIDENCE&entityId=${evidenceId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  withdrawAttachment(attachmentId: string): Promise<void> {
    return apiClient.delete<void>(`/attachments/${attachmentId}`);
  },
};
