import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IncidentEditPanel } from './incident-edit-panel';

import type { IncidentDetail } from '../../types';
import type { IncidentFormProps } from '../incident-form';

/**
 * Component-mount evidence for `IncidentEditPanel`
 * (018-incident-detail-experience, Fase 4) — mirrors `RiskEditPanel`'s own
 * shape. `../incident-form` is mocked at the module boundary: this suite's
 * job is to prove the PANEL wires the right props and chrome, not to
 * re-exercise `IncidentForm` itself (untouched, and out of this rodada's
 * scope).
 */

vi.mock('../incident-form', () => ({
  IncidentForm: (props: IncidentFormProps) => (
    <div data-testid="incident-form-mock">
      <span>mode:{props.mode}</span>
      <span>incidentId:{props.incident?.id}</span>
      <button type="button" onClick={() => props.onSaved({ ...props.incident! })}>
        Simular salvar
      </button>
    </div>
  ),
}));

const baseIncident: IncidentDetail = {
  id: 'incident-1',
  code: 'INC-2026-0001',
  title: 'Indisponibilidade do portal',
  description: 'O portal ficou indisponível por 40 minutos.',
  severity: 'HIGH',
  status: 'OPEN',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  reportedBy: { id: 'user-1', fullName: 'Ana Souza' },
  reportedOn: '2026-01-01',
};

describe('IncidentEditPanel', () => {
  it('renders the overlay header (title + description) and IncidentForm in mode="edit" for this incident', () => {
    render(<IncidentEditPanel incident={baseIncident} onOpenChange={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Editar incidente').length).toBeGreaterThan(0);
    expect(screen.getByText('Altere os dados cadastrais do incidente.')).toBeInTheDocument();
    expect(screen.getByText('mode:edit')).toBeInTheDocument();
    expect(screen.getByText('incidentId:incident-1')).toBeInTheDocument();
  });

  it('forwards IncidentForm.onSaved straight through to its own onSaved prop', () => {
    const onSaved = vi.fn();
    render(<IncidentEditPanel incident={baseIncident} onOpenChange={vi.fn()} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: 'Simular salvar' }));
    expect(onSaved).toHaveBeenCalledWith(baseIncident);
  });

  it('calls onOpenChange(false) when the sheet is dismissed', () => {
    const onOpenChange = vi.fn();
    render(
      <IncidentEditPanel incident={baseIncident} onOpenChange={onOpenChange} onSaved={vi.fn()} />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
