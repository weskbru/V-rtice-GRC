import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';

import { PublishVersionAction } from './publish-version-action';

import type { FrameworkVersion } from '../types';

const { publishFrameworkVersionMock } = vi.hoisted(() => ({
  publishFrameworkVersionMock: vi.fn(),
}));

vi.mock('../api', () => ({
  complianceApi: {
    publishFrameworkVersion: publishFrameworkVersionMock,
  },
}));

const draftVersion: FrameworkVersion = {
  id: 'version-1',
  framework: { id: 'framework-1', code: 'FMK-2026-0001', name: 'ISO 27001' },
  label: '2022',
  status: 'DRAFT',
  publishedAt: null,
  publishedBy: null,
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PublishVersionAction', () => {
  beforeEach(() => {
    publishFrameworkVersionMock.mockReset();
  });

  it('shows a warning (never a disabled button) when the version has zero requirements', () => {
    render(
      <PublishVersionAction
        frameworkId="framework-1"
        version={draftVersion}
        etag='"1"'
        requirementCount={0}
        onPublished={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/Esta versão ainda não tem nenhum requisito cadastrado/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicar versão/ })).toBeEnabled();
  });

  it('shows the real requirement count once it has loaded', () => {
    render(
      <PublishVersionAction
        frameworkId="framework-1"
        version={draftVersion}
        etag='"1"'
        requirementCount={2}
        onPublished={vi.fn()}
      />,
    );

    expect(screen.getByText('Esta versão tem 2 requisitos cadastrados.')).toBeInTheDocument();
    expect(
      screen.queryByText(/Esta versão ainda não tem nenhum requisito cadastrado/),
    ).not.toBeInTheDocument();
  });

  it('shows no hint while the count has not loaded yet', () => {
    render(
      <PublishVersionAction
        frameworkId="framework-1"
        version={draftVersion}
        etag='"1"'
        requirementCount={null}
        onPublished={vi.fn()}
      />,
    );

    expect(
      screen.queryByText(/Esta versão ainda não tem nenhum requisito cadastrado/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/requisitos cadastrados/)).not.toBeInTheDocument();
  });

  it('publishes on confirm and reports the updated record/etag', async () => {
    const onPublished = vi.fn();
    publishFrameworkVersionMock.mockResolvedValueOnce({
      record: { ...draftVersion, status: 'PUBLISHED', publishedAt: '2026-02-01T00:00:00.000Z' },
      etag: '"2"',
    });

    render(
      <PublishVersionAction
        frameworkId="framework-1"
        version={draftVersion}
        etag='"1"'
        requirementCount={1}
        onPublished={onPublished}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Publicar versão/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));

    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(publishFrameworkVersionMock).toHaveBeenCalledWith('framework-1', 'version-1', '"1"');
  });

  it('surfaces the server refusal (FR-005 — no requirement) honestly, keeping the dialog open', async () => {
    publishFrameworkVersionMock.mockRejectedValueOnce(
      new ApiError({
        title: 'Não é possível processar a solicitação',
        status: 422,
        detail: 'Não é possível publicar uma versão sem ao menos um requisito cadastrado.',
      }),
    );

    render(
      <PublishVersionAction
        frameworkId="framework-1"
        version={draftVersion}
        etag='"1"'
        requirementCount={0}
        onPublished={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Publicar versão/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));

    expect(
      await screen.findByText(
        'Não é possível publicar uma versão sem ao menos um requisito cadastrado.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeInTheDocument();
  });

  it('renders no publish action for an already-published version', () => {
    render(
      <PublishVersionAction
        frameworkId="framework-1"
        version={{ ...draftVersion, status: 'PUBLISHED' }}
        etag='"1"'
        requirementCount={0}
        onPublished={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Publicar versão/ })).not.toBeInTheDocument();
    expect(screen.getByText('Esta versão está publicada e é imutável.')).toBeInTheDocument();
  });
});
