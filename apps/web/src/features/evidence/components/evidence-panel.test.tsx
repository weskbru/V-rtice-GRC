import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { EvidencePanel } from './evidence-panel';

import type { Evidence } from '../types';

/**
 * Component-mount evidence for T038 (`EvidencePanel`, 002-shared-grc-foundation,
 * US1). `../api` is mocked at the network boundary, mirroring
 * `risk-attachments-section.test.tsx`'s own pattern.
 */

const {
  listBySubjectMock,
  listLinksMock,
  archiveEvidenceMock,
  unlinkEvidenceMock,
  searchUsersMock,
  listAttachmentsMock,
} = vi.hoisted(() => ({
  listBySubjectMock: vi.fn(),
  listLinksMock: vi.fn(),
  archiveEvidenceMock: vi.fn(),
  unlinkEvidenceMock: vi.fn(),
  searchUsersMock: vi.fn(),
  listAttachmentsMock: vi.fn(),
}));

vi.mock('../api', () => ({
  evidenceApi: {
    listBySubject: listBySubjectMock,
    listLinks: listLinksMock,
    archiveEvidence: archiveEvidenceMock,
    unlinkEvidence: unlinkEvidenceMock,
    searchUsers: searchUsersMock,
    createEvidence: vi.fn(),
    linkEvidence: vi.fn(),
    uploadAttachment: vi.fn(),
    // `EvidenceAttachmentsSection` (assurance-audit Fix 1) is mounted for
    // every evidence card now — it needs its own network mocks, mirroring
    // `evidence-attachments-section.test.tsx`'s own.
    listAttachments: listAttachmentsMock,
    withdrawAttachment: vi.fn(),
  },
}));

function evidenceFixture(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: 'evidence-1',
    code: 'EVD-2026-0001',
    orgUnit: { id: 'org-1', name: 'Unidade de teste' },
    title: 'Relatório de teste de intrusão',
    description: null,
    type: 'DOCUMENT',
    source: 'MANUAL_UPLOAD',
    owner: { id: 'user-1', fullName: 'Ana Souza' },
    collectedOn: '2026-03-01',
    validUntil: null,
    status: 'ACTIVE',
    expired: false,
    externalUrl: null,
    observation: 'Cobre a API administrativa.',
    linkCount: 1,
    archivedAt: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  };
}

/** `EvidenceCreateDialog` reads the signed-in user (S-10 default owner label), exactly as inside the real app shell. */
function renderWithSession(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <AuthProvider initialSession={buildTestSession({ permissions: [] })}>{children}</AuthProvider>
    ),
  });
}

function pageOf(items: Evidence[]) {
  return { items, page: 1, pageSize: 100, total: items.length };
}

function attachmentPageOf(items: unknown[] = []) {
  return { data: items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } };
}

beforeEach(() => {
  listBySubjectMock.mockReset();
  listLinksMock.mockReset();
  archiveEvidenceMock.mockReset();
  unlinkEvidenceMock.mockReset();
  searchUsersMock.mockReset();
  listAttachmentsMock.mockReset();
  listBySubjectMock.mockResolvedValue(pageOf([]));
  listLinksMock.mockResolvedValue([]);
  searchUsersMock.mockResolvedValue({ data: [], isPartial: false });
  listAttachmentsMock.mockResolvedValue(attachmentPageOf());
});

const BASE_PROPS = {
  subjectType: 'RISK' as const,
  subjectId: 'risk-1',
  orgUnitId: 'org-1',
  defaultOwnerUserId: 'user-1',
  canUploadAttachment: false,
  canWithdrawAttachment: false,
};

describe('EvidencePanel', () => {
  it('lists the evidence linked to the subject, with its type/source/owner metadata', async () => {
    listBySubjectMock.mockResolvedValue(pageOf([evidenceFixture({})]));
    listLinksMock.mockResolvedValue([
      { id: 'link-1', evidenceId: 'evidence-1', subjectType: 'RISK', subjectId: 'risk-1' },
    ]);

    renderWithSession(<EvidencePanel {...BASE_PROPS} canCreate canLink canAdminister />);

    await screen.findByText('EVD-2026-0001 — Relatório de teste de intrusão');
    expect(listBySubjectMock).toHaveBeenCalledWith('RISK', 'risk-1');
    expect(screen.getByText('Cobre a API administrativa.')).toBeInTheDocument();
  });

  it('renders an empty state when no evidence is linked yet', async () => {
    renderWithSession(
      <EvidencePanel {...BASE_PROPS} canCreate={false} canLink={false} canAdminister={false} />,
    );
    await waitFor(() => expect(listBySubjectMock).toHaveBeenCalled());
    expect(screen.getByText('Nenhuma evidência vinculada ainda.')).toBeInTheDocument();
  });

  it('hides the "Nova evidência" action for a caller without evidence:create', async () => {
    renderWithSession(<EvidencePanel {...BASE_PROPS} canCreate={false} canLink canAdminister />);
    await waitFor(() => expect(listBySubjectMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Nova evidência' })).not.toBeInTheDocument();
  });

  it('shows the "Nova evidência" action for a caller holding evidence:create', async () => {
    renderWithSession(
      <EvidencePanel {...BASE_PROPS} canCreate canLink={false} canAdminister={false} />,
    );
    await waitFor(() => expect(listBySubjectMock).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Nova evidência' })).toBeInTheDocument();
  });

  it('marks an expired evidence with the expired badge, distinct from its status', async () => {
    listBySubjectMock.mockResolvedValue(pageOf([evidenceFixture({ expired: true })]));

    renderWithSession(
      <EvidencePanel {...BASE_PROPS} canCreate={false} canLink={false} canAdminister={false} />,
    );

    await screen.findByText('Vencida');
    expect(screen.getByText('Ativa')).toBeInTheDocument();
  });

  it('archives an evidence after confirming, and refreshes the list', async () => {
    listBySubjectMock.mockResolvedValueOnce(pageOf([evidenceFixture({})]));
    listBySubjectMock.mockResolvedValueOnce(pageOf([evidenceFixture({ status: 'ARCHIVED' })]));
    archiveEvidenceMock.mockResolvedValue(evidenceFixture({ status: 'ARCHIVED' }));

    renderWithSession(
      <EvidencePanel {...BASE_PROPS} canCreate={false} canLink={false} canAdminister />,
    );

    const archiveButton = await screen.findByRole('button', { name: 'Arquivar' });
    fireEvent.click(archiveButton);

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Arquivar' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(archiveEvidenceMock).toHaveBeenCalledWith('evidence-1'));
    await waitFor(() => expect(listBySubjectMock).toHaveBeenCalledTimes(2));
  });

  // Assurance-audit Fix 1 (HIGH): before this fix, a file attached at
  // creation time was invisible on every other screen where evidence
  // appears — no filename, no download link, no icon, no count — and
  // `evidenceApi.listAttachments` had zero callers anywhere in the
  // product. This is the panel-level proof that the wiring is real, not
  // just `EvidenceAttachmentsSection`'s own isolated unit coverage.
  it("surfaces each evidence's attached file as a real, downloadable link", async () => {
    listBySubjectMock.mockResolvedValue(pageOf([evidenceFixture({})]));
    listAttachmentsMock.mockResolvedValue(
      attachmentPageOf([
        {
          id: 'attachment-1',
          entityType: 'EVIDENCE',
          entityId: 'evidence-1',
          fileName: 'laudo-pentest.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1_258_291,
          uploadedBy: { id: 'user-1', fullName: 'Ana Souza' },
          createdAt: '2026-03-01T10:00:00.000Z',
          contentUrl: '/api/v1/attachments/attachment-1/content',
        },
      ]),
    );

    renderWithSession(
      <EvidencePanel {...BASE_PROPS} canCreate={false} canLink={false} canAdminister={false} />,
    );

    const link = await screen.findByRole('link', { name: /laudo-pentest\.pdf/ });
    expect(link).toHaveAttribute('href', '/api/v1/attachments/attachment-1/content');
    expect(listAttachmentsMock).toHaveBeenCalledWith('evidence-1', 1, 20);
  });

  it('unlinks an evidence after confirming, without deleting it (FR-008)', async () => {
    listBySubjectMock.mockResolvedValue(pageOf([evidenceFixture({})]));
    listLinksMock.mockResolvedValue([
      { id: 'link-1', evidenceId: 'evidence-1', subjectType: 'RISK', subjectId: 'risk-1' },
    ]);
    unlinkEvidenceMock.mockResolvedValue({});

    renderWithSession(
      <EvidencePanel {...BASE_PROPS} canCreate={false} canLink canAdminister={false} />,
    );

    const unlinkButton = await screen.findByRole('button', { name: 'Desvincular' });
    fireEvent.click(unlinkButton);

    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Desvincular' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(unlinkEvidenceMock).toHaveBeenCalledWith('evidence-1', 'link-1'));
  });
});
