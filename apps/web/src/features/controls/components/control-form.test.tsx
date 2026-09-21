import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { controls } from '@/lib/messages/controls';

import { ControlForm } from './control-form';

import type { ControlDetail } from '../types';

/**
 * Component-mount evidence for T046 (`ControlForm`) — most importantly the
 * owner picker's ASSIGNMENT-listing requirement (this task's own explicit
 * instruction, mirroring the exact fix `risk-form.test.tsx` already
 * verifies for Risk): using the browse listing here would reproduce the
 * defect where a scoped analyst saw an empty owner picker.
 *
 * `../api` (`controlsApi`) is mocked at the network boundary.
 */
const { pushMock, backMock, createControlMock, updateControlMock, searchUsersMock } = vi.hoisted(
  () => ({
    pushMock: vi.fn(),
    backMock: vi.fn(),
    createControlMock: vi.fn(),
    updateControlMock: vi.fn(),
    searchUsersMock: vi.fn(),
  }),
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock('../api', () => ({
  controlsApi: {
    createControl: createControlMock,
    updateControl: updateControlMock,
    listOrgUnits: vi.fn().mockResolvedValue([
      { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
      { id: 'org-2', code: 'FILIAL', name: 'Unidade Filial' },
    ]),
    // A `vi.fn()` on its own (not `.mockResolvedValue(...)` inline) so
    // individual tests can assert the exact `(q, assignableForOrgUnitId)`
    // arguments (S-10: now searched server-side, `q` first).
    searchUsers: searchUsersMock,
  },
}));

const baseControl: ControlDetail = {
  id: 'control-1',
  code: 'CTL-2026-0001',
  name: 'Revisão trimestral de acessos privilegiados',
  descriptionExcerpt: 'Descrição original.',
  description: 'Descrição original.',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  nature: 'MANUAL',
  type: 'DETECTIVE',
  frequency: 'QUARTERLY',
  status: 'DRAFT',
  effectiveness: 'NOT_ASSESSED',
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  retiredAt: null,
  retiredBy: null,
  retirementReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('ControlForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    createControlMock.mockReset();
    updateControlMock.mockReset();
    searchUsersMock.mockReset();
    searchUsersMock.mockResolvedValue({
      data: [{ id: 'user-1', fullName: 'Ana Souza' }],
      isPartial: false,
    });
  });

  it('requires name, description and org unit — owner stays optional (FR-005)', async () => {
    render(<ControlForm mode="create" onSaved={vi.fn()} />);

    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar controle' }));

    expect(await screen.findByText(controls.form.validation.name.required)).toBeInTheDocument();
    expect(screen.getByText(controls.form.validation.description.required)).toBeInTheDocument();
    expect(screen.getByText(controls.form.validation.orgUnit.required)).toBeInTheDocument();
    expect(createControlMock).not.toHaveBeenCalled();
  });

  describe('owner picker uses the ASSIGNMENT listing for the form’s selected org unit', () => {
    it('requests the assignment listing for the org unit already selected, never the caller’s browse scope', async () => {
      render(<ControlForm mode="edit" control={baseControl} etag='"1"' onSaved={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());

      await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith('', 'org-1'));
      expect(searchUsersMock).not.toHaveBeenCalledWith('', undefined);

      fireEvent.click(screen.getByRole('combobox', { name: /Responsável pelo controle/ }));
      // `{ timeout: 3000 }`: the picker's own 300ms open debounce plus a
      // mocked async resolution can occasionally outrun the default 1000ms
      // under a heavily parallel full-suite run — measured flaky at the
      // default, stable at this one.
      expect(
        await screen.findByRole('option', { name: 'Ana Souza' }, { timeout: 3000 }),
      ).toBeInTheDocument();
    });

    it('refetches the assignment listing with the newly selected unit when the org unit changes', async () => {
      render(<ControlForm mode="create" onSaved={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());
      expect(searchUsersMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
      fireEvent.click(await screen.findByRole('option', { name: 'PharosGRC' }));
      await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith('', 'org-1'));

      fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
      fireEvent.click(await screen.findByRole('option', { name: 'Unidade Filial' }));
      await waitFor(() => expect(searchUsersMock).toHaveBeenCalledWith('', 'org-2'));
    });

    it('disables the owner picker with an explanatory message before an org unit is selected', async () => {
      render(<ControlForm mode="create" onSaved={vi.fn()} />);
      await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());

      expect(screen.getByRole('combobox', { name: /Responsável pelo controle/ })).toBeDisabled();
      expect(screen.getByText(controls.form.fields.owner.selectOrgUnitFirst)).toBeInTheDocument();
      expect(searchUsersMock).not.toHaveBeenCalled();
    });
  });

  it('creates a control without owner/nature/type/frequency, never inventing a value for an omitted classification field', async () => {
    createControlMock.mockResolvedValueOnce({
      control: {
        ...baseControl,
        id: 'control-new',
        owner: null,
        nature: null,
        type: null,
        frequency: null,
      },
      etag: '"1"',
    });
    render(<ControlForm mode="create" onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/^Nome/)).not.toBeDisabled());

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Novo controle' } });
    fireEvent.change(screen.getByLabelText(/^Descrição/), {
      target: { value: 'Descreve o que o controle faz.' },
    });
    fireEvent.click(screen.getByRole('combobox', { name: /Unidade organizacional/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'PharosGRC' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar controle' }));

    await waitFor(() => expect(createControlMock).toHaveBeenCalledTimes(1));
    const [submittedBody] = createControlMock.mock.calls[0] as [Record<string, unknown>];
    expect(submittedBody).toMatchObject({
      name: 'Novo controle',
      description: 'Descreve o que o controle faz.',
      orgUnitId: 'org-1',
      ownerUserId: null,
      nature: null,
      type: null,
      frequency: null,
    });
    // Server-owned fields must never be expressible from this form.
    expect(submittedBody).not.toHaveProperty('code');
    expect(submittedBody).not.toHaveProperty('status');
    expect(submittedBody).not.toHaveProperty('effectiveness');
    expect(submittedBody).not.toHaveProperty('version');

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/controls/control-new'));
  });

  /**
   * F-79 (`docs/deferred-findings.md`) — "Cancelar" defaults to
   * `navigate.back()` when no `onCancel` is supplied (the register's own
   * `/controls/new` page, and any other caller that has not opted in),
   * exactly as it always has; a caller composing this form inside something
   * that is NOT itself a navigation (`ControlEditPanel`'s own overlay
   * `Sheet`) supplies `onCancel` instead, and that — never `navigate.back()`
   * — is what fires. Both paths are proven here so neither can silently
   * regress into the other.
   */
  it('"Cancelar" calls navigate.back() when no onCancel is supplied — the default, unchanged for /controls/new', () => {
    render(<ControlForm mode="create" onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it('"Cancelar" calls the supplied onCancel instead of navigate.back() when one is provided', () => {
    const onCancel = vi.fn();
    render(
      <ControlForm
        mode="edit"
        control={baseControl}
        etag='"1"'
        onSaved={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(backMock).not.toHaveBeenCalled();
  });
});
