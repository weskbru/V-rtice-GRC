import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ControlCard } from './control-card';

import type { ControlSummary } from '../types';

/**
 * Component-mount evidence for the catalog's card view (CLAUDE.md §18),
 * mirroring `risk-card.test.tsx`'s fixture shape and regression coverage.
 */
const baseControl: ControlSummary = {
  id: 'control-1',
  code: 'CTL-2026-0001',
  name: 'Revisão trimestral de acessos privilegiados',
  descriptionExcerpt: 'Descrição resumida do controle para pré-visualização.',
  orgUnit: { id: 'org-1', code: 'ROOT', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Ana Souza' },
  nature: 'MANUAL',
  type: 'DETECTIVE',
  frequency: 'QUARTERLY',
  status: 'ACTIVE',
  effectiveness: 'EFFECTIVE',
  version: 1,
  // Midday UTC — see `risk-card.test.tsx`'s own fixture comment for why not midnight.
  updatedAt: '2026-09-04T12:00:00.000Z',
};

describe('ControlCard', () => {
  it('renders the last update as a calendar date, never "Invalid Date"', () => {
    render(<ControlCard control={baseControl} selected={false} onSelect={vi.fn()} />);

    expect(screen.getByText('Atualizado em 04/09/2026')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });

  it('renders the code as a link to the full record', () => {
    render(<ControlCard control={baseControl} selected={false} onSelect={vi.fn()} />);

    const link = screen.getByRole('link', { name: 'CTL-2026-0001' });
    expect(link).toHaveAttribute('href', '/controls/control-1');
  });

  it('calls onSelect with the control id when the name button is clicked', () => {
    const onSelect = vi.fn();
    render(<ControlCard control={baseControl} selected={false} onSelect={onSelect} />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Abrir prévia de CTL-2026-0001 — Revisão trimestral de acessos privilegiados',
      }),
    );

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('control-1');
  });

  it('exposes selection state via aria-pressed on the name button', () => {
    const { rerender } = render(
      <ControlCard control={baseControl} selected={false} onSelect={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Abrir prévia/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    rerender(<ControlCard control={baseControl} selected onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Abrir prévia/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renders status and effectiveness each with an icon, a colour and a text label — never colour alone', () => {
    const { container } = render(
      <ControlCard control={baseControl} selected={false} onSelect={vi.fn()} />,
    );

    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Efetivo')).toBeInTheDocument();
    expect(container.querySelector('article')).toHaveAttribute('data-tone', 'success');
  });

  it('renders "Sem responsável definido", never a blank field, for a control with no owner', () => {
    const unowned: ControlSummary = { ...baseControl, owner: null };
    render(<ControlCard control={unowned} selected={false} onSelect={vi.fn()} />);

    expect(screen.getByText('Sem responsável definido')).toBeInTheDocument();
  });

  it('never shows the description excerpt when there is none', () => {
    const noDescription: ControlSummary = { ...baseControl, descriptionExcerpt: null };
    render(<ControlCard control={noDescription} selected={false} onSelect={vi.fn()} />);

    expect(
      screen.queryByText('Descrição resumida do controle para pré-visualização.'),
    ).not.toBeInTheDocument();
  });
});
