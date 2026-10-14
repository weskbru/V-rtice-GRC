import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { buildMyActionsColumns, MY_ACTIONS_COLUMN_IDS } from './my-actions-columns';

import type { Action } from '../types';

const baseAction: Action = {
  id: 'action-1',
  code: 'ACT-2026-0001',
  orgUnit: { id: 'org-1', name: 'Vértice GRC' },
  originType: 'RISK_TREATMENT',
  originId: 'risk-1',
  originLabel: 'RSK-2026-0001 — Falha no fornecedor crítico',
  title: 'Corrigir configuração de firewall',
  description: null,
  responsible: { id: 'user-1', fullName: 'Ana Souza' },
  dueOn: '2026-05-01',
  status: 'OPEN',
  overdue: false,
  completedAt: null,
  reopenedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function cellOf(
  columns: ReturnType<typeof buildMyActionsColumns>,
  id: string,
): (context: { row: { original: Action } }) => React.ReactNode {
  const column = columns.find((candidate) => candidate.id === id);
  if (!column || typeof column.cell !== 'function') {
    throw new Error(`Column "${id}" has no function cell renderer`);
  }
  return column.cell as (context: { row: { original: Action } }) => React.ReactNode;
}

function buildColumns(canEdit = true): ReturnType<typeof buildMyActionsColumns> {
  return buildMyActionsColumns({ canEdit, onTransition: vi.fn(), onReopenRequest: vi.fn() });
}

describe('buildMyActionsColumns', () => {
  it('never offers sorting on any column (GET /actions has no sort parameter)', () => {
    const columns = buildColumns();
    for (const column of columns) {
      expect(column.enableSorting).toBe(false);
    }
  });

  it('keeps code/title always visible (never hideable)', () => {
    const columns = buildColumns();
    expect(columns.find((c) => c.id === MY_ACTIONS_COLUMN_IDS.code)?.enableHiding).toBe(false);
    expect(columns.find((c) => c.id === MY_ACTIONS_COLUMN_IDS.title)?.enableHiding).toBe(false);
  });

  it("links the code column to /actions/{id} — this screen's own detail route", () => {
    const cell = cellOf(buildColumns(), MY_ACTIONS_COLUMN_IDS.code);
    render(<>{cell({ row: { original: baseAction } })}</>);
    const link = screen.getByRole('link', { name: baseAction.code });
    expect(link).toHaveAttribute('href', '/actions/action-1');
  });

  it('links the origin to /risks/{originId} for RISK_TREATMENT', () => {
    const cell = cellOf(buildColumns(), MY_ACTIONS_COLUMN_IDS.origin);
    render(<>{cell({ row: { original: baseAction } })}</>);
    const link = screen.getByRole('link', { name: baseAction.originLabel });
    expect(link).toHaveAttribute('href', '/risks/risk-1');
  });

  it('links the origin to /incidents/{originId} for INCIDENT', () => {
    const cell = cellOf(buildColumns(), MY_ACTIONS_COLUMN_IDS.origin);
    render(
      <>
        {cell({
          row: {
            original: {
              ...baseAction,
              originType: 'INCIDENT',
              originId: 'incident-1',
              originLabel: 'INC-2026-0001',
            },
          },
        })}
      </>,
    );
    const link = screen.getByRole('link', { name: 'INC-2026-0001' });
    expect(link).toHaveAttribute('href', '/incidents/incident-1');
  });

  it('links the origin to /problems/{originId} for PROBLEM', () => {
    const cell = cellOf(buildColumns(), MY_ACTIONS_COLUMN_IDS.origin);
    render(
      <>
        {cell({
          row: {
            original: {
              ...baseAction,
              originType: 'PROBLEM',
              originId: 'problem-1',
              originLabel: 'PRB-2026-0001',
            },
          },
        })}
      </>,
    );
    const link = screen.getByRole('link', { name: 'PRB-2026-0001' });
    expect(link).toHaveAttribute('href', '/problems/problem-1');
  });

  it('renders the origin as plain text (never a broken link) for FINDING — no standalone detail route', () => {
    const cell = cellOf(buildColumns(), MY_ACTIONS_COLUMN_IDS.origin);
    render(
      <>
        {cell({
          row: {
            original: { ...baseAction, originType: 'FINDING', originLabel: undefined },
          },
        })}
      </>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Achado')).toBeInTheDocument();
  });

  it('renders the origin as plain text (never a broken link) for CONTROL_ASSESSMENT — originId is the assessment, not the control', () => {
    const cell = cellOf(buildColumns(), MY_ACTIONS_COLUMN_IDS.origin);
    render(
      <>
        {cell({
          row: {
            original: {
              ...baseAction,
              originType: 'CONTROL_ASSESSMENT',
              originId: 'assessment-1',
              originLabel: undefined,
            },
          },
        })}
      </>,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Verificação de controle')).toBeInTheDocument();
  });

  it('falls back to the origin type label when originLabel is not resolvable', () => {
    const cell = cellOf(buildColumns(), MY_ACTIONS_COLUMN_IDS.origin);
    render(<>{cell({ row: { original: { ...baseAction, originLabel: undefined } } })}</>);
    expect(screen.getByText('Tratamento de risco')).toBeInTheDocument();
  });

  it('shows the overdue indicator only when the row is actually overdue', () => {
    const cell = cellOf(buildColumns(), MY_ACTIONS_COLUMN_IDS.dueOn);

    render(<>{cell({ row: { original: { ...baseAction, overdue: false } } })}</>);
    expect(screen.queryByText('Atrasada')).not.toBeInTheDocument();

    render(<>{cell({ row: { original: { ...baseAction, overdue: true } } })}</>);
    expect(screen.getByText('Atrasada')).toBeInTheDocument();
  });

  it('shows a status badge with the pt-BR label', () => {
    const cell = cellOf(buildColumns(), MY_ACTIONS_COLUMN_IDS.status);
    render(<>{cell({ row: { original: { ...baseAction, status: 'IN_PROGRESS' } } })}</>);
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
  });

  it('omits the row-actions column entirely when canEdit is false (FR-042 — advisory only)', () => {
    const columns = buildColumns(false);
    expect(columns.find((c) => c.id === MY_ACTIONS_COLUMN_IDS.rowActions)).toBeUndefined();
  });

  it('offers no row-actions menu for a CANCELLED (terminal) action, even when canEdit is true', () => {
    const cell = cellOf(buildColumns(true), MY_ACTIONS_COLUMN_IDS.rowActions);
    const { container } = render(
      <>{cell({ row: { original: { ...baseAction, status: 'CANCELLED' } } })}</>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a row-actions menu with the legal transitions for an OPEN action', () => {
    const cell = cellOf(buildColumns(true), MY_ACTIONS_COLUMN_IDS.rowActions);
    render(<>{cell({ row: { original: baseAction } })}</>);
    expect(screen.getByRole('button', { name: 'Ações' })).toBeInTheDocument();
  });
});
