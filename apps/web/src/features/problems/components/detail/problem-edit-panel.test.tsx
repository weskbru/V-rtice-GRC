import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProblemEditPanel } from './problem-edit-panel';

import type { ProblemDetail } from '../../types';
import type { ProblemFormProps } from '../problem-form';

/**
 * Component-mount evidence for `ProblemEditPanel`
 * (019-problem-detail-experience, Fase C) — mirrors `IncidentEditPanel`'s
 * own shape. `../problem-form` is mocked at the module boundary: this
 * suite's job is to prove the PANEL wires the right props and chrome, not
 * to re-exercise `ProblemForm` itself (untouched, and out of this rodada's
 * scope).
 */

vi.mock('../problem-form', () => ({
  ProblemForm: (props: ProblemFormProps) => (
    <div data-testid="problem-form-mock">
      <span>mode:{props.mode}</span>
      <span>problemId:{props.problem?.id}</span>
      <button type="button" onClick={() => props.onSaved({ ...props.problem! })}>
        Simular salvar
      </button>
    </div>
  ),
}));

const baseProblem: ProblemDetail = {
  id: 'problem-1',
  code: 'PRB-2026-0001',
  title: 'Falhas recorrentes de autenticação',
  description: 'Investigação da causa raiz das falhas recorrentes.',
  severity: 'HIGH',
  status: 'OPEN',
  orgUnit: { id: 'org-1', code: 'ORG-1', name: 'Unidade de teste' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  identifiedOn: '2026-02-01',
};

describe('ProblemEditPanel', () => {
  it('renders the overlay header (title + description) and ProblemForm in mode="edit" for this problem', () => {
    render(<ProblemEditPanel problem={baseProblem} onOpenChange={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Editar problema').length).toBeGreaterThan(0);
    expect(screen.getByText('Altere os dados cadastrais do problema.')).toBeInTheDocument();
    expect(screen.getByText('mode:edit')).toBeInTheDocument();
    expect(screen.getByText('problemId:problem-1')).toBeInTheDocument();
  });

  it('forwards ProblemForm.onSaved straight through to its own onSaved prop', () => {
    const onSaved = vi.fn();
    render(<ProblemEditPanel problem={baseProblem} onOpenChange={vi.fn()} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simular salvar' }));
    expect(onSaved).toHaveBeenCalledWith(baseProblem);
  });

  it('calls onOpenChange(false) when the sheet is dismissed', () => {
    const onOpenChange = vi.fn();
    render(
      <ProblemEditPanel problem={baseProblem} onOpenChange={onOpenChange} onSaved={vi.fn()} />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
