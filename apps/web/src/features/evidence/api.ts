/**
 * PharosGRC frontend — Evidence API wrapper (T036, 002-shared-grc-foundation,
 * US1). A thin, typed layer over `apiClient`, mirroring `features/risks/api
 * .ts`'s own shape. `Evidence` carries no optimistic-concurrency field
 * (data-model.md §2) — unlike `risksApi`, no `ETag`/`If-Match` handling is
 * needed anywhere here.
 */
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
  /** `GET /evidence?subjectType=&subjectId=` — the read path a domain
   * screen (e.g. the risk detail page) uses to show its own evidence
   * without leaving its context (SC-001; contracts/grc-foundation
   * .openapi.yaml's own revision note — this filter was added during US1
   * implementation, closing a gap the original design left open). */
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

  /**
   * `GET /users?q=` — the reduced directory lookup, reused here for the
   * evidence responsible-person picker rather than importing across feature
   * boundaries, searched server-side (S-10: a fixed `pageSize=100` with no
   * search silently hid every user beyond the first page).
   */
  async searchUsers(q: string): Promise<{ data: readonly UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  /** `POST /attachments` — attaches a file to an evidence record, via the
   * SAME generic mechanism a risk's own attachments use
   * (`entityType: EVIDENCE`), created strictly AFTER the evidence exists
   * (see `schema.prisma`'s own `Evidence` section header for why). */
  async uploadAttachment(evidenceId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.set('entityType', 'EVIDENCE' satisfies CollaborationEntityType);
    formData.set('entityId', evidenceId);
    formData.set('file', file);
    const { data } = await apiClient.postFormWithMeta<Attachment>('/attachments', formData);
    return data;
  },

  /** `GET /attachments?entityType=EVIDENCE&entityId=` — paginated, mirroring `risksApi.listAttachments`'s own signature. */
  async listAttachments(
    evidenceId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<Attachment>> {
    return apiClient.get<Page<Attachment>>(
      `/attachments?entityType=EVIDENCE&entityId=${evidenceId}&page=${page}&pageSize=${pageSize}`,
    );
  },

  /** `DELETE /attachments/{attachmentId}` — `attachment:delete`, the SAME entity-type-independent permission `risksApi.withdrawAttachment` uses (`AttachmentController`'s own header comment). */
  withdrawAttachment(attachmentId: string): Promise<void> {
    return apiClient.delete<void>(`/attachments/${attachmentId}`);
  },
};
