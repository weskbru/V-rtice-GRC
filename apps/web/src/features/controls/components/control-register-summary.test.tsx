import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ControlRegisterSummary } from './control-register-summary';

import type { Page } from '../types';

/**
 * Component-mount evidence for `ControlRegisterSummary` (CLAUDE.md §19.7) —
 * `controlsApi.listCatalog` is mocked at the network boundary, mirroring
 * `risk-register-summary.test.tsx`'s own approach. Each mocked call
 * resolves a distinct `meta.total`, keyed by the query it received, so a
 * wrong filter (e.g. showing the "ineffective" count under "Ativos") fails
 * one of the assertions rather than passing by coincidence.
 */
const { listCatalogMock } = vi.hoisted(() => ({ listCatalogMock: vi.fn() }));

vi.mock('../api', () => ({
  controlsApi: { listCatalog: listCatalogMock },
}));

function pageWithTotal(total: number): Page<never> {
  return { data: [], meta: { page: 1, pageSize: 1, total, totalPages: 1 } };
}

function mockCounts({
  total,
  active,
  ineffective,
  expired,
}: {
  total: number;
  active: number;
  ineffective: number;
  expired: number;
}): void {
  listCatalogMock.mockImplementation((query: { status?: string[]; effectiveness?: string[] }) => {
    if (query.status?.includes('ACTIVE')) return Promise.resolve(pageWithTotal(active));
    if (query.effectiveness?.includes('INEFFECTIVE'))
      return Promise.resolve(pageWithTotal(ineffective));
    if (query.effectiveness?.includes('EXPIRED')) return Promise.resolve(pageWithTotal(expired));
    return Promise.resolve(pageWithTotal(total));
  });
}

describe('ControlRegisterSummary', () => {
  it('renders the exact figure for each of the four indicators, from the correct filtered query', async () => {
    mockCounts({ total: 210, active: 150, ineffective: 6, expired: 12 });
    render(<ControlRegisterSummary />);

    await waitFor(() => expect(screen.getByText('210')).toBeInTheDocument());
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('links each indicator to the exact catalog filter it summarizes', async () => {
    mockCounts({ total: 210, active: 150, ineffective: 6, expired: 12 });
    render(<ControlRegisterSummary />);

    await waitFor(() => expect(screen.getByText('210')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Ver todos os controles' })).toHaveAttribute(
      'href',
      '/controls',
    );
    expect(screen.getByRole('link', { name: 'Ver controles ativos' })).toHaveAttribute(
      'href',
      '/controls?status=ACTIVE',
    );
    expect(screen.getByRole('link', { name: 'Ver controles inefetivos' })).toHaveAttribute(
      'href',
      '/controls?effectiveness=INEFFECTIVE',
    );
    expect(
      screen.getByRole('link', { name: 'Ver controles com efetividade vencida' }),
    ).toHaveAttribute('href', '/controls?effectiveness=EXPIRED');
  });

  it('renders only the quiet error line, with no indicator cards, when the request fails', async () => {
    listCatalogMock.mockRejectedValue(new Error('network down'));
    render(<ControlRegisterSummary />);

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível carregar o resumo do catálogo.'),
      ).toBeInTheDocument(),
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
