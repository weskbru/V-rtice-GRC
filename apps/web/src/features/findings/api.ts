/**
 * PharosGRC frontend — Finding API wrapper (T075, 002-shared-grc-foundation,
 * US3). A thin, typed layer over `apiClient`, mirroring `features/evidence/api
 * .ts`'s own shape. `Finding` carries no optimistic-concurrency field
 * (data-model.md §5) — no `ETag`/`If-Match` handling needed anywhere here.
 *
 * 005-audit-findings adds the 7 `/findings/{findingId}/...` operations of
 * `specs/005-audit-findings/contracts/audit.openapi.yaml` below
 * (`start-remediation`, `controls` x3, `risks` x3) — see `types.ts`'s own
 * header comment for why they live here rather than in
 * `features/audit-engagements/api.ts`. None of them carries `If-Match`
 * either: `startFindingRemediation` follows `Finding`'s own transition-table
 * safety instead of optimistic locking (research.md D-18), and the two link
 * kinds are independent, separately-keyed rows.
 */
import { apiClient } from '@/lib/api-client';

import type {
  CloseFindingRequest,
  ControlRef,
  CreateFindingControlLinkRequest,
  CreateFindingRequest,
  CreateFindingRiskLinkRequest,
  Finding,
  FindingControlLink,
  FindingPage,
  FindingRiskLink,
  FindingSummary,
  ReopenFindingRequest,
  RiskRef,
  UpdateFindingRequest,
} from './types';
import type { Page, RegistrySearchResult, UserRef } from '@/features/risks/types';

export const findingsApi = {
  /** `GET /findings?orgUnitId=` — the risk detail screen's own "Achados"
   * panel read path (contracts/grc-foundation.openapi.yaml's `listFindings`
   * own revision note: this phase models no direct Finding-to-Risk
   * relationship, so the panel scopes by organizational unit instead). */
  async listByOrgUnit(orgUnitId: string): Promise<FindingPage> {
    return apiClient.get<FindingPage>(`/findings?orgUnitId=${orgUnitId}&pageSize=100`);
  },

  async getFinding(findingId: string): Promise<Finding> {
    return apiClient.get<Finding>(`/findings/${findingId}`);
  },

  async createFinding(body: CreateFindingRequest): Promise<Finding> {
    return apiClient.post<Finding>('/findings', body);
  },

  async updateFinding(findingId: string, body: UpdateFindingRequest): Promise<Finding> {
    return apiClient.patch<Finding>(`/findings/${findingId}`, body);
  },

  async closeFinding(findingId: string, body: CloseFindingRequest): Promise<Finding> {
    return apiClient.post<Finding>(`/findings/${findingId}/close`, body);
  },

  async reopenFinding(findingId: string, body: ReopenFindingRequest): Promise<Finding> {
    return apiClient.post<Finding>(`/findings/${findingId}/reopen`, body);
  },

  async archiveFinding(findingId: string): Promise<Finding> {
    return apiClient.post<Finding>(`/findings/${findingId}/archive`);
  },

  /**
   * `GET /users?q=` — the same reduced directory lookup `evidenceApi
   * .listUsers` already wraps, reused here for the owner picker, now
   * searched server-side (S-10: a fixed `pageSize=100` with no search
   * silently hid every owner beyond the first page).
   */
  async searchUsers(q: string): Promise<{ data: readonly UserRef[]; isPartial: boolean }> {
    const params = new URLSearchParams({ pageSize: '20' });
    if (q) params.set('q', q);
    const page = await apiClient.get<Page<UserRef>>(`/users?${params.toString()}`);
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  // -------------------------------------------------------------------
  // Remediation (005-audit-findings, US2, FR-009, research.md D-10) — the
  // first, and only, caller in this codebase to ever request the
  // OPEN -> IN_REMEDIATION transition.
  // -------------------------------------------------------------------

  /** `POST /findings/{findingId}/start-remediation` — legal only from `OPEN`; `422` otherwise. No request body. Returns the reduced `FindingSummary` shape (not `Finding`) per the contract. */
  async startRemediation(findingId: string): Promise<FindingSummary> {
    return apiClient.post<FindingSummary>(`/findings/${findingId}/start-remediation`);
  },

  // -------------------------------------------------------------------
  // Finding <-> Control (005-audit-findings, US3, FR-013/FR-014, ADR-020)
  // -------------------------------------------------------------------

  /** `GET /findings/{findingId}/controls` — not paginated (bounded by what an auditor explicitly linked). `includeWithdrawn` also returns withdrawn links. */
  listControlLinks(
    findingId: string,
    includeWithdrawn = false,
  ): Promise<readonly FindingControlLink[]> {
    return apiClient.get<readonly FindingControlLink[]>(
      `/findings/${findingId}/controls?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /** `POST /findings/{findingId}/controls` — the control must be `ACTIVE` and within the caller's organizational scope (ADR-020 part 4); the finding must not be `ARCHIVED`. */
  linkControl(
    findingId: string,
    body: CreateFindingControlLinkRequest,
  ): Promise<FindingControlLink> {
    return apiClient.post<FindingControlLink>(`/findings/${findingId}/controls`, body);
  },

  /** `DELETE /findings/{findingId}/controls/{linkId}` — withdraws the link (stamps `unlinkedAt`/`unlinkedBy`); the row is preserved, never deleted (FR-016). */
  unlinkControl(findingId: string, linkId: string): Promise<FindingControlLink> {
    return apiClient.delete<FindingControlLink>(`/findings/${findingId}/controls/${linkId}`);
  },

  // -------------------------------------------------------------------
  // Finding <-> Risk (005-audit-findings, US3, FR-015/FR-016, ADR-020)
  // -------------------------------------------------------------------

  /** `GET /findings/{findingId}/risks` — same shape as `listControlLinks` above, against `Risk` instead of `Control`. */
  listRiskLinks(findingId: string, includeWithdrawn = false): Promise<readonly FindingRiskLink[]> {
    return apiClient.get<readonly FindingRiskLink[]>(
      `/findings/${findingId}/risks?includeWithdrawn=${String(includeWithdrawn)}`,
    );
  },

  /** `POST /findings/{findingId}/risks` — the risk must not be `ARCHIVED` and must lie within the caller's organizational scope (ADR-020 part 4); the finding must not be `ARCHIVED`. */
  linkRisk(findingId: string, body: CreateFindingRiskLinkRequest): Promise<FindingRiskLink> {
    return apiClient.post<FindingRiskLink>(`/findings/${findingId}/risks`, body);
  },

  /** `DELETE /findings/{findingId}/risks/{linkId}` — withdraws the link; the row is preserved, never deleted (FR-016). */
  unlinkRisk(findingId: string, linkId: string): Promise<FindingRiskLink> {
    return apiClient.delete<FindingRiskLink>(`/findings/${findingId}/risks/${linkId}`);
  },

  // -------------------------------------------------------------------
  // Registry pickers for the two link sections above (T078) — a direct,
  // independent read of each registry's own list endpoint, mirroring
  // `complianceApi.listControls`/`risksApi.listControls`'s own convention
  // (a business module declares its OWN minimal registry-fetch rather than
  // importing another feature's API client, CLAUDE.md §2/§4). A control or
  // risk outside the caller's organizational scope simply never appears in
  // these options — the LINK attempt itself is what the server
  // authoritatively re-checks (ADR-020 part 4), never this picker.
  // -------------------------------------------------------------------

  /** `GET /controls?pageSize=25&q=` — no `status` filter: a retired, suspended or draft control still appears here, because history is preserved by design (FR-013's own "deliberate" note). */
  async listControlOptions(q: string): Promise<RegistrySearchResult<ControlRef>> {
    const page = await apiClient.get<Page<ControlRef>>(
      `/controls?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },

  /** `GET /risks?pageSize=25&q=` — same reasoning as `listControlOptions` above: an archived risk still appears here (FR-015's own "deliberate" note). */
  async listRiskOptions(q: string): Promise<RegistrySearchResult<RiskRef>> {
    const page = await apiClient.get<Page<RiskRef>>(
      `/risks?pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    );
    return { data: page.data, isPartial: page.data.length < page.meta.total };
  },
};
