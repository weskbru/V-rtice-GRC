import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ControlEditPanel } from './control-edit-panel';

import type { ControlDetail } from '../../types';
import type { ControlFormProps } from '../control-form';

/**
 * Component-mount evidence for `ControlEditPanel`
 * (021-control-detail-experience, Fase C) — mirrors `ProblemEditPanel`'s/
 * `ActionEditPanel`'s own shape. `../control-form` is mocked at the module
 * boundary: this suite's job is to prove the PANEL wires the right props
 * and chrome, not to re-exercise `ControlForm` itself (untouched, and out
 * of this rodada's scope).
 */

vi.mock('../control-form', () => ({
  ControlForm: (props: ControlFormProps) => (
    <div data-testid="control-form-mock">
      <span>mode:{props.mode}</span>
      <span>controlId:{props.control?.id}</span>
      <button
        type="button"
        onClick={() => props.onSaved({ control: props.control!, etag: props.etag! })}
      >
        Simular salvar
      </button>
      {/* F-79 (`docs/deferred-findings.md`): the real `ControlForm` calls
          `props.onCancel` if supplied, `navigate.back()` otherwise. This
          mock stands in only for the `onCancel` branch — the default
          `navigate.back()` fallback is `control-form.test.tsx`'s own
          responsibility, not this panel's. */}
      <button type="button" onClick={() => props.onCancel?.()}>
        Simular cancelar
      </button>
    </div>
  ),
}));

const baseControl: ControlDetail = {
  id: 'control-1',
  code: 'CTL-2026-0001',
  name: 'Revisão de acessos privilegiados',
  descriptionExcerpt: 'Revisão trimestral dos acessos privilegiados.',
  orgUnit: { id: 'org-1', code: 'ORG-1', name: 'Unidade de teste' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  nature: 'MANUAL',
  type: 'DETECTIVE',
  frequency: 'QUARTERLY',
  status: 'DRAFT',
  effectiveness: 'NOT_ASSESSED',
  version: 1,
  updatedAt: '2026-09-12T11:02:00.000Z',
  description: 'Revisão trimestral dos acessos privilegiados.',
  retiredAt: null,
  retiredBy: null,
  retirementReason: null,
  createdAt: '2026-09-08T00:00:00.000Z',
};

describe('ControlEditPanel', () => {
  it('renders the overlay header (title + description) and ControlForm in mode="edit" for this control', () => {
    render(
      <ControlEditPanel
        control={baseControl}
        etag='"1"'
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Editar controle').length).toBeGreaterThan(0);
    expect(screen.getByText('Altere os dados cadastrais do controle.')).toBeInTheDocument();
    expect(screen.getByText('mode:edit')).toBeInTheDocument();
    expect(screen.getByText('controlId:control-1')).toBeInTheDocument();
  });

  it('forwards ControlForm.onSaved straight through to its own onSaved prop', () => {
    const onSaved = vi.fn();
    render(
      <ControlEditPanel
        control={baseControl}
        etag='"1"'
        onOpenChange={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Simular salvar' }));
    expect(onSaved).toHaveBeenCalledWith({ control: baseControl, etag: '"1"' });
  });

  it('calls onOpenChange(false) when the sheet is dismissed', () => {
    const onOpenChange = vi.fn();
    render(
      <ControlEditPanel
        control={baseControl}
        etag='"1"'
        onOpenChange={onOpenChange}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  /**
   * F-79 — `ControlForm`'s own "Cancelar" must close through the SAME
   * `onOpenChange(false)` the `Sheet`'s `X`/`Escape` already use, never a
   * second, independently-written mechanism (e.g. `navigate.back()`,
   * which took a caller off `/controls/{id}` entirely before this fix —
   * `docs/deferred-findings.md`).
   */
  it('wires ControlForm.onCancel to the same onOpenChange(false) the Sheet’s own X/Escape use', () => {
    const onOpenChange = vi.fn();
    render(
      <ControlEditPanel
        control={baseControl}
        etag='"1"'
        onOpenChange={onOpenChange}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Simular cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
