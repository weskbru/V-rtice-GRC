import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessLifecycleActions } from './process-lifecycle-actions';

import type { ProcessDetail } from '../types';

const { deactivateProcessMock, reactivateProcessMock } = vi.hoisted(() => ({
  deactivateProcessMock: vi.fn(),
  reactivateProcessMock: vi.fn(),
}));

vi.mock('../api', () => ({
  processesApi: {
    deactivateProcess: deactivateProcessMock,
    reactivateProcess: reactivateProcessMock,
  },
}));

function buildProcess(overrides: Partial<ProcessDetail> = {}): ProcessDetail {
  return {
    id: 'process-1',
    code: 'PRC-2026-0001',
    name: 'Aprovação de despesas',
    descriptionExcerpt: null,
    description: null,
    orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    risks: [],
    controls: [],
    ...overrides,
  };
}

describe('ProcessLifecycleActions', () => {
  beforeEach(() => {
    deactivateProcessMock.mockReset();
    reactivateProcessMock.mockReset();
  });

  it('renders nothing for a caller without process:administer (server-mirrored gate)', () => {
    const { container } = render(
      <ProcessLifecycleActions
        process={buildProcess()}
        canAdminister={false}
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only "Desativar" for an active process, and the confirmation states this is not deletion (FR-012)', () => {
    render(<ProcessLifecycleActions process={buildProcess()} canAdminister onChanged={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reativar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    expect(screen.getByText('Desativar este processo?')).toBeInTheDocument();
    expect(
      screen.getByText(/continua totalmente legível e continua aparecendo nos vínculos/),
    ).toBeInTheDocument();
    expect(screen.getByText(/nada é apagado/)).toBeInTheDocument();
  });

  it('deactivates the process on confirmation and reports the updated record', async () => {
    const onChanged = vi.fn();
    const updated = buildProcess({ isActive: false });
    deactivateProcessMock.mockResolvedValue(updated);

    render(
      <ProcessLifecycleActions process={buildProcess()} canAdminister onChanged={onChanged} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    await waitFor(() => expect(deactivateProcessMock).toHaveBeenCalledWith('process-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
  });

  it('shows only "Reativar" for an inactive process, with a confirmation that never mentions deletion', async () => {
    const onChanged = vi.fn();
    const updated = buildProcess({ isActive: true });
    reactivateProcessMock.mockResolvedValue(updated);

    render(
      <ProcessLifecycleActions
        process={buildProcess({ isActive: false })}
        canAdminister
        onChanged={onChanged}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reativar' }));

    expect(screen.getByText('Reativar este processo?')).toBeInTheDocument();

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reativar' }));

    await waitFor(() => expect(reactivateProcessMock).toHaveBeenCalledWith('process-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(updated));
  });

  it('shows a generic error and does not report a change when the request fails', async () => {
    deactivateProcessMock.mockRejectedValue(new Error('network down'));

    render(<ProcessLifecycleActions process={buildProcess()} canAdminister onChanged={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desativar' }));

    expect(
      await screen.findByText('Não foi possível desativar o processo. Tente novamente.'),
    ).toBeInTheDocument();
  });
});
