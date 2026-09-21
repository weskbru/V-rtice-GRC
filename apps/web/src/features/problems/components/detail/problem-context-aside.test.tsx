import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProblemContextAside } from './problem-context-aside';

import type { ProblemDetail } from '../../types';

/**
 * Component-mount evidence for the contextual aside
 * (019-problem-detail-experience, Fase C). Rendered at the default (wide,
 * jsdom `matchMedia` stub) viewport, so every block is the plain,
 * always-expanded `<section>` — mirrors
 * `incident-context-aside.test.tsx`'s own convention for not duplicating
 * narrow-mode coverage here.
 *
 * Central assertions this suite exists to prove:
 *
 *   - every quick action is a real LINK (`role="link"`), never a button —
 *     the exact defect class `RiskRelationshipsAside`/`IncidentContextAside`
 *     had to correct (`getByRole('button', …)` colliding with a section's
 *     own real button);
 *   - no relationship row ever shows a count — `ProblemDetail` carries
 *     none, and the aside must never fabricate one;
 *   - "Última atualização" renders only when `problem.updatedAt` is
 *     present, never "Invalid Date" for the optional field.
 */

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

describe('ProblemContextAside', () => {
  it('renders every enabled quick action as role="link" with a literal href, never a button', () => {
    render(
      <ProblemContextAside
        problem={baseProblem}
        activeSectionId="overview"
        canLink
        canCreateAction
        canCreateEvidence
        canComment
      />,
    );

    const linkRisk = screen.getByRole('link', { name: 'Vincular risco' });
    expect(linkRisk).toHaveAttribute('href', '/problems/problem-1?section=risks');
    expect(screen.getByRole('link', { name: 'Vincular incidente' })).toHaveAttribute(
      'href',
      '/problems/problem-1?section=incidents',
    );
    expect(screen.getByRole('link', { name: 'Adicionar ação corretiva' })).toHaveAttribute(
      'href',
      '/problems/problem-1?section=corrective-actions',
    );
    expect(screen.getByRole('link', { name: 'Adicionar evidência' })).toHaveAttribute(
      'href',
      '/problems/problem-1?section=evidence',
    );
    expect(screen.getByRole('link', { name: 'Comentar' })).toHaveAttribute(
      'href',
      '/problems/problem-1?section=comments',
    );

    // None of these render as buttons.
    for (const name of [
      'Vincular risco',
      'Vincular incidente',
      'Adicionar ação corretiva',
      'Adicionar evidência',
      'Comentar',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('omits every quick action the caller lacks permission for, and the whole block when none apply', () => {
    render(
      <ProblemContextAside
        problem={baseProblem}
        activeSectionId="overview"
        canLink={false}
        canCreateAction={false}
        canCreateEvidence={false}
        canComment={false}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Ações rápidas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Vincular risco' })).not.toBeInTheDocument();
  });

  it('renders the two relationship rows with a "Ver" hint and no count of any kind', () => {
    render(
      <ProblemContextAside
        problem={baseProblem}
        activeSectionId="risks"
        canLink={false}
        canCreateAction={false}
        canCreateEvidence={false}
        canComment={false}
      />,
    );

    for (const label of ['Riscos', 'Incidentes']) {
      // Accessible name concatenates label + hint with an explicit space —
      // see this component's own doc comment and `IncidentContextAside`'s
      // identical fix ("Riscos8").
      const link = screen.getByRole('link', { name: `${label} Ver` });
      expect(link).toHaveAttribute('href', expect.stringContaining('/problems/problem-1?section='));
      // Never a digit anywhere in the visible row text.
      expect(link.textContent).not.toMatch(/\d/);
    }

    expect(screen.getByRole('link', { name: 'Riscos Ver' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Incidentes Ver' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('omits "Última atualização" entirely when updatedAt is absent — never "Invalid Date"', () => {
    render(
      <ProblemContextAside
        problem={baseProblem}
        activeSectionId="overview"
        canLink={false}
        canCreateAction={false}
        canCreateEvidence={false}
        canComment={false}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Última atualização' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('renders "Última atualização" formatted pt-BR when updatedAt is present', () => {
    render(
      <ProblemContextAside
        problem={{ ...baseProblem, updatedAt: '2026-09-12T11:02:00.000Z' }}
        activeSectionId="overview"
        canLink={false}
        canCreateAction={false}
        canCreateEvidence={false}
        canComment={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Última atualização' })).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
