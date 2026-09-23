import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProblemCard } from './problem-card';

import type { ProblemSummary } from '../types';

const baseProblem: ProblemSummary = {
  id: 'problem-1',
  code: 'PRB-2026-0001',
  title: 'Falhas recorrentes no processo de aprovação',
  severity: 'HIGH',
  status: 'IN_ANALYSIS',
  orgUnit: { id: 'org-1', code: 'ORG-1', name: 'PharosGRC' },
  owner: { id: 'user-1', fullName: 'Bruno Lima' },
  identifiedOn: '2026-03-10',
  updatedAt: '2026-03-20T12:00:00.000Z',
};

describe('ProblemCard', () => {
  it('shows the code and title, each linking to /problems/{id}', () => {
    render(<ProblemCard problem={baseProblem} />);

    expect(screen.getByRole('link', { name: baseProblem.code })).toHaveAttribute(
      'href',
      '/problems/problem-1',
    );
    expect(
      screen.getByRole('link', { name: /Falhas recorrentes no processo de aprovação/ }),
    ).toHaveAttribute('href', '/problems/problem-1');
  });

  it('shows severity and status badges with their pt-BR labels', () => {
    render(<ProblemCard problem={baseProblem} />);

    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Em análise')).toBeInTheDocument();
  });

  it('shows the org unit, owner and identified-on metadata fields, and the updated-at footer', () => {
    render(<ProblemCard problem={baseProblem} />);

    expect(screen.getByText('PharosGRC')).toBeInTheDocument();
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument();
    expect(screen.getByText('10/03/2026')).toBeInTheDocument();
    expect(screen.getByText('Atualizado em 20/03/2026')).toBeInTheDocument();
  });

  it('never renders a description row — ProblemSummary carries none', () => {
    render(<ProblemCard problem={baseProblem} />);
    expect(screen.queryByText('Descrição')).not.toBeInTheDocument();
  });
});
