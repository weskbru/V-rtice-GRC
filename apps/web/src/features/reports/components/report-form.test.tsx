import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component-mount evidence for `ReportForm` (009-indicators-reports, T061). `../api`
 * (`reportsApi`) is mocked at the network boundary, mirroring `framework-form.test.tsx`'s own
 * shape.
 *
 * `screen.getByLabelText` returns a plain `HTMLElement`; the F-56 regression test below needs
 * `.value`, which only exists on `HTMLInputElement`/`HTMLTextAreaElement`. Narrowed through a
 * named helper for the same reason `login-form.test.tsx`'s own `asInputElement` exists — an
 * inline assertion trips `@typescript-eslint/no-unnecessary-type-assertion` inconsistently.
 */
function asValueElement(element: HTMLElement): HTMLInputElement | HTMLTextAreaElement {
  return element as HTMLInputElement | HTMLTextAreaElement;
}
const { pushMock, backMock, createDefinitionMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backMock: vi.fn(),
  createDefinitionMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, back: backMock }),
}));

vi.mock('../api', () => ({
  reportsApi: { createDefinition: createDefinitionMock },
}));

import { ReportForm } from './report-form';

describe('ReportForm', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    createDefinitionMock.mockReset();
  });

  it('requires name, description and at least one metric', async () => {
    render(<ReportForm onCreated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Criar relatório' }));

    expect(await screen.findByText('Informe um nome para o relatório.')).toBeInTheDocument();
    expect(screen.getByText('Informe uma descrição para o relatório.')).toBeInTheDocument();
    expect(screen.getByText('Selecione ao menos um indicador.')).toBeInTheDocument();
    expect(createDefinitionMock).not.toHaveBeenCalled();
  });

  it('creates a report with the selected metric keys and navigates back to the catalog', async () => {
    const created = {
      id: 'report-1',
      code: 'RPT-2026-0001',
      name: 'Painel executivo',
      description: 'Indicadores para a diretoria.',
      metricKeys: ['CONTROL_INACTIVE_COUNT'],
      isActive: true,
      createdBy: { id: 'user-1', fullName: 'Ada Analyst' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    createDefinitionMock.mockResolvedValueOnce(created);
    const onCreated = vi.fn();

    render(<ReportForm onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: 'Painel executivo' } });
    fireEvent.change(screen.getByLabelText(/^Descrição/), {
      target: { value: 'Indicadores para a diretoria.' },
    });
    fireEvent.click(screen.getByLabelText('Controles inativos'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar relatório' }));

    await waitFor(() =>
      expect(createDefinitionMock).toHaveBeenCalledWith({
        name: 'Painel executivo',
        description: 'Indicadores para a diretoria.',
        metricKeys: ['CONTROL_INACTIVE_COUNT'],
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(pushMock).toHaveBeenCalledWith('/reports');
  });

  it('toggling a metric checkbox updates the selected-count copy', () => {
    render(<ReportForm onCreated={vi.fn()} />);

    expect(screen.getByText('0 indicadores selecionados')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Controles inativos'));
    expect(screen.getByText('1 indicador selecionado')).toBeInTheDocument();
  });

  it('submits whatever is in the DOM even without a prior React change event (F-56/D-21 regression)', async () => {
    // F-56 (`docs/deferred-findings.md`): `name`/`description` are the same shape D-21 found in
    // the login form — a value typed before hydration finishes never reaches React via
    // `onChange`, landing on a plain DOM node nothing is listening to yet. Setting `.value`
    // directly (bypassing `fireEvent.change`, which dispatches a React-observable synthetic
    // event and would mask exactly this) reproduces that. The fix reads the DOM at submit time
    // rather than trusting `react-hook-form`'s tracked state, so this must pass regardless of
    // how the value got there.
    const created = {
      id: 'report-1',
      code: 'RPT-2026-0001',
      name: 'Painel pré-hidratação',
      description: 'Preenchido antes da hidratação.',
      metricKeys: ['CONTROL_INACTIVE_COUNT'],
      isActive: true,
      createdBy: { id: 'user-1', fullName: 'Ada Analyst' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    createDefinitionMock.mockResolvedValueOnce(created);
    render(<ReportForm onCreated={vi.fn()} />);

    const nameInput = asValueElement(screen.getByLabelText(/^Nome/));
    const descriptionInput = asValueElement(screen.getByLabelText(/^Descrição/));
    nameInput.value = 'Painel pré-hidratação';
    descriptionInput.value = 'Preenchido antes da hidratação.';

    fireEvent.click(screen.getByLabelText('Controles inativos'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar relatório' }));

    await waitFor(() =>
      expect(createDefinitionMock).toHaveBeenCalledWith({
        name: 'Painel pré-hidratação',
        description: 'Preenchido antes da hidratação.',
        metricKeys: ['CONTROL_INACTIVE_COUNT'],
      }),
    );
  });
});
