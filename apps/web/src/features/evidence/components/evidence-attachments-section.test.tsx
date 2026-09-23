import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { EvidenceAttachmentsSection } from './evidence-attachments-section';

import type { Attachment } from '@/features/risks/types';

const { listAttachmentsMock, uploadAttachmentMock, withdrawAttachmentMock } = vi.hoisted(() => ({
  listAttachmentsMock: vi.fn(),
  uploadAttachmentMock: vi.fn(),
  withdrawAttachmentMock: vi.fn(),
}));

vi.mock('../api', () => ({
  evidenceApi: {
    listAttachments: listAttachmentsMock,
    uploadAttachment: uploadAttachmentMock,
    withdrawAttachment: withdrawAttachmentMock,
  },
}));

function attachmentFixture(overrides: Partial<Attachment>): Attachment {
  return {
    id: 'attachment-1',
    entityType: 'EVIDENCE',
    entityId: 'evidence-1',
    fileName: 'laudo.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1_258_291,
    uploadedBy: { id: 'user-1', fullName: 'Ana Souza' },
    createdAt: '2026-09-05T14:32:00.000Z',
    contentUrl: '/api/v1/attachments/attachment-1/content',
    ...overrides,
  };
}

function pageOf(items: Attachment[]) {
  return { data: items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } };
}

beforeEach(() => {
  listAttachmentsMock.mockReset();
  uploadAttachmentMock.mockReset();
  withdrawAttachmentMock.mockReset();
  listAttachmentsMock.mockResolvedValue(pageOf([]));
});

const LABEL = 'EVD-2026-0001 — Relatório de teste de intrusão';

describe('EvidenceAttachmentsSection', () => {
  it('lists the attachments scoped to this evidence, each linking to its authorizing download path', async () => {
    listAttachmentsMock.mockResolvedValue(pageOf([attachmentFixture({})]));

    render(
      <EvidenceAttachmentsSection
        evidenceId="evidence-1"
        evidenceLabel={LABEL}
        canUpload
        canWithdraw
      />,
    );

    const link = await screen.findByRole('link', { name: /laudo\.pdf/ });
    expect(link).toHaveAttribute('href', '/api/v1/attachments/attachment-1/content');
    expect(listAttachmentsMock).toHaveBeenCalledWith('evidence-1', 1, 20);
  });

  it('hides the upload control for a caller without attachment:create', async () => {
    render(
      <EvidenceAttachmentsSection
        evidenceId="evidence-1"
        evidenceLabel={LABEL}
        canUpload={false}
        canWithdraw={false}
      />,
    );
    await waitFor(() => expect(listAttachmentsMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();
  });

  it('uploads a file to ALREADY-EXISTING evidence, and refreshes the list', async () => {
    uploadAttachmentMock.mockResolvedValue(attachmentFixture({}));
    render(
      <EvidenceAttachmentsSection
        evidenceId="evidence-1"
        evidenceLabel={LABEL}
        canUpload
        canWithdraw={false}
      />,
    );
    await waitFor(() => expect(listAttachmentsMock).toHaveBeenCalledTimes(1));

    const file = new File(['%PDF-1.4 conteúdo'], 'laudo.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Selecionar arquivo'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar arquivo' }));

    await waitFor(() => expect(uploadAttachmentMock).toHaveBeenCalledWith('evidence-1', file));
    await waitFor(() => expect(listAttachmentsMock).toHaveBeenCalledTimes(2));
  });

  it("surfaces the server's own refusal reason verbatim — never a generic failure message", async () => {
    uploadAttachmentMock.mockRejectedValue(
      new ApiError({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'O tipo de arquivo declarado não corresponde ao conteúdo enviado.',
      }),
    );
    render(
      <EvidenceAttachmentsSection
        evidenceId="evidence-1"
        evidenceLabel={LABEL}
        canUpload
        canWithdraw={false}
      />,
    );
    await waitFor(() => expect(listAttachmentsMock).toHaveBeenCalledTimes(1));

    const file = new File(['isto não é um PDF de verdade'], 'laudo.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(screen.getByLabelText('Selecionar arquivo'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar arquivo' }));

    expect(
      await screen.findByText('O tipo de arquivo declarado não corresponde ao conteúdo enviado.'),
    ).toBeInTheDocument();
  });

  it('withdraws the attachment after confirmation, without a separate withdraw permission implying upload', async () => {
    listAttachmentsMock.mockResolvedValue(pageOf([attachmentFixture({})]));
    withdrawAttachmentMock.mockResolvedValue(undefined);
    render(
      <EvidenceAttachmentsSection
        evidenceId="evidence-1"
        evidenceLabel={LABEL}
        canUpload={false}
        canWithdraw
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }));
    await screen.findByText('Remover anexo?');
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() => expect(withdrawAttachmentMock).toHaveBeenCalledWith('attachment-1'));
    expect(screen.queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();
  });
});
