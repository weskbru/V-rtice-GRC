import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FrameworkForm } from './framework-form';

import type { Framework } from '../types';

/**
 * Component-mount evidence for `FrameworkForm` (US1, FR-001). `../api`
 * (`complianceApi`) is mocked at the network boundary.
 *
 * `screen.getByLabelText` returns a plain `HTMLElement`; the F-56 regression test below needs
 * `.value`, which only exists on `HTMLInputElement`/`HTMLTextAreaElement`. Narrowed through a
 * named helper for the same reason `login-form.test.tsx`'s own `asInputElement` exists — an
 * inline assertion trips `@typescript-eslint/no-unnecessary-type-assertion` inconsistently.
 */
function asValueElement(element: HTMLElement): HTMLInputElement | HTMLTextAreaElement {
  return element as HTMLInputElement | HTMLTextAreaElement;
}
const { pushMock, backMock, createFrameworkMock, updateFrameworkMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backMock: vi.fn(),
  createFrameworkMock: vi.fn(),
  updateFrameworkMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock('../api', () => ({
  complianceApi: {
    createFramework: createFrameworkMock,
    updateFramework: updateFrameworkMock,
  },
}));

const baseFramework: Framework = {
  id: 'framework-1',
  code: 'FMK-2026-0001',
  name: 'ISO 27001',
  description: 'Norma internacional de segurança da informação.',
  origin: 'EXTERNAL_STANDARD',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('FrameworkForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    createFrameworkMock.mockReset();
    updateFrameworkMock.mockReset();
  });

  it('requires name, description and origin', async () => {
    render(<FrameworkForm mode="create" onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar framework' }));

    expect(await screen.findByText('Informe o nome do framework.')).toBeInTheDocument();
    expect(screen.getByText('Informe uma descrição.')).toBeInTheDocument();
    expect(screen.getByText('Selecione a origem do framework.')).toBeInTheDocument();
    expect(createFrameworkMock).not.toHaveBeenCalled();
  });

  it('creates a framework and navigates to its detail page', async () => {
    createFrameworkMock.mockResolvedValueOnce({ record: baseFramework, etag: '"1"' });
    const onSaved = vi.fn();

    render(<FrameworkForm mode="create" onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'ISO 27001' } });
    fireEvent.change(screen.getByLabelText(/^Descrição/), {
      target: { value: 'Norma internacional de segurança da informação.' },
    });
    fireEvent.click(screen.getByRole('combobox', { name: /^Origem/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Norma externa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar framework' }));

    await waitFor(() =>
      expect(createFrameworkMock).toHaveBeenCalledWith({
        name: 'ISO 27001',
        description: 'Norma internacional de segurança da informação.',
        origin: 'EXTERNAL_STANDARD',
      }),
    );
    expect(onSaved).toHaveBeenCalledWith({ framework: baseFramework, etag: '"1"' });
    expect(pushMock).toHaveBeenCalledWith('/compliance/framework-1');
  });

  it('saves an edit against the record’s current etag', async () => {
    const updated = { ...baseFramework, name: 'ISO 27001:2022', version: 2 };
    updateFrameworkMock.mockResolvedValueOnce({ record: updated, etag: '"2"' });
    const onSaved = vi.fn();

    render(<FrameworkForm mode="edit" framework={baseFramework} etag='"1"' onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'ISO 27001:2022' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(updateFrameworkMock).toHaveBeenCalledWith(
        'framework-1',
        expect.objectContaining({ name: 'ISO 27001:2022' }),
        '"1"',
      ),
    );
    expect(onSaved).toHaveBeenCalledWith({ framework: updated, etag: '"2"' });
  });

  it('submits whatever is in the DOM even without a prior React change event (F-56/D-21 regression)', async () => {
    // F-56 (`docs/deferred-findings.md`): `name`/`description` are the same shape D-21 found in
    // the login form — a value typed before hydration finishes never reaches React via
    // `onChange`, landing on a plain DOM node nothing is listening to yet. Setting `.value`
    // directly (bypassing `fireEvent.change`, which dispatches a React-observable synthetic
    // event and would mask exactly this) reproduces that. The fix reads the DOM at submit time
    // rather than trusting `react-hook-form`'s tracked state, so this must pass regardless of
    // how the value got there.
    createFrameworkMock.mockResolvedValueOnce({ record: baseFramework, etag: '"1"' });
    const onSaved = vi.fn();

    render(<FrameworkForm mode="create" onSaved={onSaved} />);

    const nameInput = asValueElement(screen.getByLabelText(/^Nome/));
    const descriptionInput = asValueElement(screen.getByLabelText(/^Descrição/));
    nameInput.value = 'ISO 27001';
    descriptionInput.value = 'Norma internacional de segurança da informação.';

    fireEvent.click(screen.getByRole('combobox', { name: /^Origem/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Norma externa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar framework' }));

    await waitFor(() =>
      expect(createFrameworkMock).toHaveBeenCalledWith({
        name: 'ISO 27001',
        description: 'Norma internacional de segurança da informação.',
        origin: 'EXTERNAL_STANDARD',
      }),
    );
    expect(onSaved).toHaveBeenCalledWith({ framework: baseFramework, etag: '"1"' });
  });
});
