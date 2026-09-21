import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IncidentCommentsSection } from './incident-comments-section';

import type { Comment } from '@/features/risks/types';

/**
 * Component-mount evidence for `IncidentCommentsSection` (CLAUDE.md
 * §19.10 remediation), mirroring `risk-comments-section.test.tsx` exactly
 * — `../api` is mocked at the network boundary; the stored-XSS rendering
 * guarantee is covered once by `CommentThread`'s own tests.
 */

const { listCommentsMock, createCommentMock, withdrawCommentMock } = vi.hoisted(() => ({
  listCommentsMock: vi.fn(),
  createCommentMock: vi.fn(),
  withdrawCommentMock: vi.fn(),
}));

vi.mock('@/features/incidents/api', () => ({
  incidentsApi: {
    listComments: listCommentsMock,
    createComment: createCommentMock,
    withdrawComment: withdrawCommentMock,
  },
}));

function commentFixture(overrides: Partial<Comment>): Comment {
  return {
    id: 'comment-1',
    entityType: 'INCIDENT',
    entityId: 'incident-1',
    body: 'Investigação em andamento.',
    author: { id: 'user-1', fullName: 'Ana Souza' },
    createdAt: '2026-09-05T14:32:00.000Z',
    ...overrides,
  };
}

function pageOf(items: Comment[]) {
  return { data: items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } };
}

beforeEach(() => {
  listCommentsMock.mockReset();
  createCommentMock.mockReset();
  withdrawCommentMock.mockReset();
  listCommentsMock.mockResolvedValue(pageOf([]));
});

describe('IncidentCommentsSection', () => {
  it('lists the comments scoped to this incident', async () => {
    listCommentsMock.mockResolvedValue(pageOf([commentFixture({})]));

    render(<IncidentCommentsSection incidentId="incident-1" canComment canWithdraw />);

    expect(await screen.findByText('Investigação em andamento.')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(listCommentsMock).toHaveBeenCalledWith('incident-1', 1, 20);
  });

  it('hides the composer for a caller without comment:create', async () => {
    render(
      <IncidentCommentsSection incidentId="incident-1" canComment={false} canWithdraw={false} />,
    );
    await waitFor(() => expect(listCommentsMock).toHaveBeenCalled());
    expect(screen.queryByLabelText('Novo comentário')).not.toBeInTheDocument();
  });

  it('submits a new comment and refreshes the list', async () => {
    createCommentMock.mockResolvedValue(commentFixture({}));
    render(<IncidentCommentsSection incidentId="incident-1" canComment canWithdraw={false} />);
    await waitFor(() => expect(listCommentsMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Novo comentário'), {
      target: { value: 'Um novo comentário sobre este incidente.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));

    await waitFor(() =>
      expect(createCommentMock).toHaveBeenCalledWith(
        'incident-1',
        'Um novo comentário sobre este incidente.',
      ),
    );
    await waitFor(() => expect(listCommentsMock).toHaveBeenCalledTimes(2));
  });

  it('asks for confirmation before withdrawing, and states the comment is retained in the audit trail, not erased', async () => {
    listCommentsMock.mockResolvedValue(pageOf([commentFixture({})]));
    render(<IncidentCommentsSection incidentId="incident-1" canComment={false} canWithdraw />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }));

    expect(await screen.findByText('Remover comentário?')).toBeInTheDocument();
    expect(screen.getByText(/continua registrado na trilha de auditoria/)).toBeInTheDocument();
    expect(withdrawCommentMock).not.toHaveBeenCalled();
  });

  it('withdraws the comment after confirmation', async () => {
    listCommentsMock.mockResolvedValue(pageOf([commentFixture({})]));
    withdrawCommentMock.mockResolvedValue(undefined);
    render(<IncidentCommentsSection incidentId="incident-1" canComment={false} canWithdraw />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }));
    await screen.findByText('Remover comentário?');
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() => expect(withdrawCommentMock).toHaveBeenCalledWith('comment-1'));
  });

  it('does not offer withdrawal for a caller without comment:delete', async () => {
    listCommentsMock.mockResolvedValue(pageOf([commentFixture({})]));
    render(
      <IncidentCommentsSection incidentId="incident-1" canComment={false} canWithdraw={false} />,
    );
    await screen.findByText('Investigação em andamento.');
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
  });
});
