import { describe, expect, it } from 'vitest';

import { actionStatusBadgeVariant, actionStatusLabel, availableTransitions } from './status';

describe('availableTransitions', () => {
  it('offers "Iniciar"/"Cancelar" from OPEN', () => {
    const options = availableTransitions('OPEN');
    expect(options.map((option) => option.to)).toEqual(['IN_PROGRESS', 'CANCELLED']);
    expect(options.every((option) => !option.requiresReason)).toBe(true);
  });

  it('offers "Concluir"/"Cancelar" from IN_PROGRESS', () => {
    const options = availableTransitions('IN_PROGRESS');
    expect(options.map((option) => option.to)).toEqual(['COMPLETED', 'CANCELLED']);
    expect(options.every((option) => !option.requiresReason)).toBe(true);
  });

  it('offers only "Reabrir" from COMPLETED, and requires a reason for it', () => {
    const options = availableTransitions('COMPLETED');
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ to: 'OPEN', requiresReason: true });
  });

  it('offers nothing from CANCELLED — a terminal status', () => {
    expect(availableTransitions('CANCELLED')).toHaveLength(0);
  });
});

describe('actionStatusLabel / actionStatusBadgeVariant', () => {
  it('labels every status in pt-BR', () => {
    expect(actionStatusLabel('OPEN')).toBe('Aberta');
    expect(actionStatusLabel('IN_PROGRESS')).toBe('Em andamento');
    expect(actionStatusLabel('COMPLETED')).toBe('Concluída');
    expect(actionStatusLabel('CANCELLED')).toBe('Cancelada');
  });

  it('never relies on the same badge variant to distinguish OPEN from CANCELLED (FR-091 — text label carries the difference)', () => {
    expect(actionStatusBadgeVariant('OPEN')).toBe(actionStatusBadgeVariant('CANCELLED'));
    expect(actionStatusLabel('OPEN')).not.toBe(actionStatusLabel('CANCELLED'));
  });

  it('gives COMPLETED a distinct, positive variant', () => {
    expect(actionStatusBadgeVariant('COMPLETED')).toBe('success');
  });
});
