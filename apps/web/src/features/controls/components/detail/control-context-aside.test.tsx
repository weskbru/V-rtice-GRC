import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ControlContextAside } from './control-context-aside';

import type { ControlDetail } from '../../types';

/**
 * Component-mount evidence for the contextual aside
 * (021-control-detail-experience, Fase C). Rendered at the default (wide,
 * jsdom `matchMedia` stub) viewport, so every block is the plain,
 * always-expanded `<section>` — mirrors `problem-context-aside.test.tsx`'s
 * own convention for not duplicating narrow-mode coverage here.
 *
 * Central assertions this suite exists to prove:
 *
 *   - every quick action is a real LINK (`role="link"`), never a button —
 *     the exact defect class `ProblemContextAside`'s own header comment
 *     documents costing three specs on Risk;
 *   - the single "Vínculos" relationship row never shows a count —
 *     `ControlDetail` carries none, and the aside must never fabricate one;
 *   - "Última atualização" renders only when `control.updatedAt` is
 *     present, never "Invalid Date" for the optional field.
 */

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

describe('ControlContextAside', () => {
  it('renders every enabled quick action as role="link" with a literal href, never a button', () => {
    render(
      <ControlContextAside
        control={baseControl}
        activeSectionId="overview"
        canTest
        canLinkRelationships
        canCreateEvidence
        canViewEvidence
      />,
    );

    expect(screen.getByRole('link', { name: 'Registrar verificação' })).toHaveAttribute(
      'href',
      '/controls/control-1?section=assessments',
    );
    expect(screen.getByRole('link', { name: 'Vincular processo ou ativo' })).toHaveAttribute(
      'href',
      '/controls/control-1?section=relationships',
    );
    expect(screen.getByRole('link', { name: 'Adicionar evidência' })).toHaveAttribute(
      'href',
      '/controls/control-1?section=evidence',
    );

    for (const name of [
      'Registrar verificação',
      'Vincular processo ou ativo',
      'Adicionar evidência',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('omits every quick action the caller lacks permission for, and the whole block when none apply', () => {
    render(
      <ControlContextAside
        control={baseControl}
        activeSectionId="overview"
        canTest={false}
        canLinkRelationships={false}
        canCreateEvidence={false}
        canViewEvidence={false}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Ações rápidas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Registrar verificação' })).not.toBeInTheDocument();
  });

  it('requires BOTH evidence:create and evidence:view before offering the evidence shortcut — a section that would silently redirect is never linked to', () => {
    render(
      <ControlContextAside
        control={baseControl}
        activeSectionId="overview"
        canTest={false}
        canLinkRelationships={false}
        canCreateEvidence
        canViewEvidence={false}
      />,
    );

    expect(screen.queryByRole('link', { name: 'Adicionar evidência' })).not.toBeInTheDocument();
  });

  it('renders the single "Vínculos" relationship row with a "Ver" hint and no count of any kind', () => {
    render(
      <ControlContextAside
        control={baseControl}
        activeSectionId="relationships"
        canTest={false}
        canLinkRelationships={false}
        canCreateEvidence={false}
        canViewEvidence={false}
      />,
    );

    // Accessible name concatenates label + hint with an explicit space —
    // see this component's own doc comment and `ProblemContextAside`'s
    // identical fix.
    const link = screen.getByRole('link', { name: 'Vínculos Ver' });
    expect(link).toHaveAttribute('href', '/controls/control-1?section=relationships');
    expect(link.textContent).not.toMatch(/\d/);
    expect(link).toHaveAttribute('aria-current', 'true');
  });

  it('does not mark the relationships row current when a different section is active', () => {
    render(
      <ControlContextAside
        control={baseControl}
        activeSectionId="overview"
        canTest={false}
        canLinkRelationships={false}
        canCreateEvidence={false}
        canViewEvidence={false}
      />,
    );

    expect(screen.getByRole('link', { name: 'Vínculos Ver' })).not.toHaveAttribute('aria-current');
  });

  it('omits "Última atualização" entirely when updatedAt is absent — never "Invalid Date"', () => {
    render(
      <ControlContextAside
        control={{ ...baseControl, updatedAt: '' }}
        activeSectionId="overview"
        canTest={false}
        canLinkRelationships={false}
        canCreateEvidence={false}
        canViewEvidence={false}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Última atualização' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders "Última atualização" formatted pt-BR when updatedAt is present', () => {
    render(
      <ControlContextAside
        control={baseControl}
        activeSectionId="overview"
        canTest={false}
        canLinkRelationships={false}
        canCreateEvidence={false}
        canViewEvidence={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Última atualização' })).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
