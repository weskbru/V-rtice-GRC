import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { RiskAttachmentsSection } from './risk-attachments-section';

import type { Attachment } from '../types';

const { listAttachmentsMock, uploadAttachmentMock, withdrawAttachmentMock } = vi.hoisted(() => ({
  listAttachmentsMock: vi.fn(),
  uploadAttachmentMock: vi.fn(),
  withdrawAttachmentMock: vi.fn(),
}));

vi.mock('../api', () => ({
  risksApi: {
    listAttachments: listAttachmentsMock,
    uploadAttachment: uploadAttachmentMock,
    withdrawAttachment: withdrawAttachmentMock,
  },
}));

function attachmentFixture(overrides: Partial<Attachment>): Attachment {
  return {
    id: 'attachment-1',
    entityType: 'RISK',
    entityId: 'risk-1',
    fileName: 'evidencia.pdf',
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

describe('RiskAttachmentsSection', () => {
  it('lists the attachments scoped to this risk, each linking to its authorizing download path', async () => {
    listAttachmentsMock.mockResolvedValue(pageOf([attachmentFixture({})]));

    render(<RiskAttachmentsSection riskId="risk-1" canUpload canWithdraw />);

    const link = await screen.findByRole('link', { name: /evidencia\.pdf/ });
    expect(link).toHaveAttribute('href', '/api/v1/attachments/attachment-1/content');
    expect(listAttachmentsMock).toHaveBeenCalledWith('risk-1', 1, 20);
  });

  it('states the allow-listed types and size limit before any file is chosen (US9 AS3)', async () => {
    render(<RiskAttachmentsSection riskId="risk-1" canUpload canWithdraw={false} />);
    await waitFor(() => expect(listAttachmentsMock).toHaveBeenCalled());
    expect(screen.getByText(/PDF, PNG, JPEG ou texto simples.*25 MB/)).toBeInTheDocument();
  });

  it('hides the upload control for a caller without attachment:create', async () => {
    render(<RiskAttachmentsSection riskId="risk-1" canUpload={false} canWithdraw={false} />);
    await waitFor(() => expect(listAttachmentsMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();
  });

  it('uploads the chosen file and refreshes the list', async () => {
    uploadAttachmentMock.mockResolvedValue(attachmentFixture({}));
    render(<RiskAttachmentsSection riskId="risk-1" canUpload canWithdraw={false} />);
    await waitFor(() => expect(listAttachmentsMock).toHaveBeenCalledTimes(1));

    const file = new File(['%PDF-1.4 conteúdo'], 'evidencia.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Selecionar arquivo'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar arquivo' }));

    await waitFor(() => expect(uploadAttachmentMock).toHaveBeenCalledWith('risk-1', file));
    await waitFor(() => expect(listAttachmentsMock).toHaveBeenCalledTimes(2));
  });

  it("surfaces the server's own refusal reason verbatim on a magic-byte mismatch — never a generic failure message", async () => {
    uploadAttachmentMock.mockRejectedValue(
      new ApiError({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'O tipo de arquivo declarado não corresponde ao conteúdo enviado.',
      }),
    );
    render(<RiskAttachmentsSection riskId="risk-1" canUpload canWithdraw={false} />);
    await waitFor(() => expect(listAttachmentsMock).toHaveBeenCalledTimes(1));

    const file = new File(['isto não é um PDF de verdade'], 'evidencia.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(screen.getByLabelText('Selecionar arquivo'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar arquivo' }));

    expect(
      await screen.findByText('O tipo de arquivo declarado não corresponde ao conteúdo enviado.'),
    ).toBeInTheDocument();
  });

  it('asks for confirmation before withdrawing, and states the attachment is retained in the audit trail, not erased (FR-102)', async () => {
    listAttachmentsMock.mockResolvedValue(pageOf([attachmentFixture({})]));
    render(<RiskAttachmentsSection riskId="risk-1" canUpload={false} canWithdraw />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }));

    expect(await screen.findByText('Remover anexo?')).toBeInTheDocument();
    expect(screen.getByText(/evidencia\.pdf.*não é apagado/)).toBeInTheDocument();
    expect(withdrawAttachmentMock).not.toHaveBeenCalled();
  });

  it('withdraws the attachment after confirmation', async () => {
    listAttachmentsMock.mockResolvedValue(pageOf([attachmentFixture({})]));
    withdrawAttachmentMock.mockResolvedValue(undefined);
    render(<RiskAttachmentsSection riskId="risk-1" canUpload={false} canWithdraw />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }));
    await screen.findByText('Remover anexo?');
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() => expect(withdrawAttachmentMock).toHaveBeenCalledWith('attachment-1'));
  });
});
