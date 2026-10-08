import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProblemOverview } from './problem-overview';

import type { ProblemDetail } from '../types';

function buildProblem(overrides: Partial<ProblemDetail> = {}): ProblemDetail {
  return {
    id: 'problem-1',
    code: 'PRB-2026-0001',
    title: 'Falhas recorrentes de autenticação',
    description: 'Investigação da causa raiz das falhas recorrentes.',
    severity: 'HIGH',
    status: 'OPEN',
    orgUnit: { id: 'org-1', code: 'ORG-1', name: 'Unidade de teste' },
    owner: { id: 'user-1', fullName: 'Ana Souza' },
    identifiedOn: '2026-02-01',
    ...overrides,
  };
}

describe('ProblemOverview', () => {
  it('renders the Descrição and Detalhes do problema cards, with all four attributes', () => {
    render(<ProblemOverview problem={buildProblem({ createdAt: '2026-02-01T08:00:00.000Z' })} />);

    expect(screen.getByText('Descrição')).toBeInTheDocument();
    expect(
      screen.getByText('Investigação da causa raiz das falhas recorrentes.'),
    ).toBeInTheDocument();

    expect(screen.getByText('Detalhes do problema')).toBeInTheDocument();
    expect(screen.getByText('Severidade')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Unidade organizacional')).toBeInTheDocument();
    expect(screen.getByText('Unidade de teste')).toBeInTheDocument();
    expect(screen.getByText('Responsável')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('Identificado em')).toBeInTheDocument();
  });

  it('renders the honest empty state in the Causa raiz card when rootCause is null — never a placeholder that reads like content', () => {
    render(<ProblemOverview problem={buildProblem({ rootCause: null })} />);

    expect(screen.getByText('Causa raiz')).toBeInTheDocument();
    expect(
      screen.getByText('A causa raiz deste problema ainda não foi identificada.'),
    ).toBeInTheDocument();
  });

  it('renders the identified root cause in its own card, with the empty state gone', () => {
    render(
      <ProblemOverview
        problem={buildProblem({ rootCause: 'Configuração incorreta do provedor de identidade.' })}
      />,
    );

    expect(screen.getByText('Causa raiz')).toBeInTheDocument();
    expect(
      screen.getByText('Configuração incorreta do provedor de identidade.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('A causa raiz deste problema ainda não foi identificada.'),
    ).not.toBeInTheDocument();
  });

  it('renders "Registrado em" only when createdAt is present', () => {
    const { rerender } = render(
      <ProblemOverview problem={buildProblem({ createdAt: undefined })} />,
    );
    expect(screen.queryByText('Registrado em')).not.toBeInTheDocument();

    rerender(<ProblemOverview problem={buildProblem({ createdAt: '2026-02-01T08:00:00.000Z' })} />);
    expect(screen.getByText('Registrado em')).toBeInTheDocument();
  });

  it('never renders the resolution/closure/cancellation outcome facts — those moved to Ciclo de vida', () => {
    render(
      <ProblemOverview
        problem={buildProblem({
          status: 'RESOLVED',
          rootCause: 'Configuração incorreta.',
          resolvedAt: '2026-02-04T10:00:00.000Z',
        })}
      />,
    );

    expect(screen.queryByText('Resolvido em')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolvido por')).not.toBeInTheDocument();
  });
});
