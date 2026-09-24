import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ProcessRegisterSummary } from './process-register-summary';

import type { Page } from '../types';

const { listCatalogMock } = vi.hoisted(() => ({ listCatalogMock: vi.fn() }));

vi.mock('../api', () => ({
  processesApi: { listCatalog: listCatalogMock },
}));

function pageWithTotal(total: number): Page<never> {
  return { data: [], meta: { page: 1, pageSize: 1, total, totalPages: 1 } };
}

function mockCounts({
  total,
  active,
  inactive,
}: {
  total: number;
  active: number;
  inactive: number;
}): void {
  listCatalogMock.mockImplementation((query: { isActive?: boolean }) => {
    if (query.isActive === true) return Promise.resolve(pageWithTotal(active));
    if (query.isActive === false) return Promise.resolve(pageWithTotal(inactive));
    return Promise.resolve(pageWithTotal(total));
  });
}

describe('ProcessRegisterSummary', () => {
  it('renders the exact figure for each of the three indicators, from the correctly filtered query', async () => {
    mockCounts({ total: 42, active: 30, inactive: 12 });
    render(<ProcessRegisterSummary />);

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('links each indicator to the exact register filter it summarizes', async () => {
    mockCounts({ total: 42, active: 30, inactive: 12 });
    render(<ProcessRegisterSummary />);

    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: 'Ver todos os processos' })).toHaveAttribute(
      'href',
      '/processes',
    );
    expect(screen.getByRole('link', { name: 'Ver processos em uso' })).toHaveAttribute(
      'href',
      '/processes?isActive=true',
    );
    expect(screen.getByRole('link', { name: 'Ver processos desativados' })).toHaveAttribute(
      'href',
      '/processes?isActive=false',
    );
  });

  it('renders only the quiet error line, with no indicator cards, when the request fails', async () => {
    listCatalogMock.mockRejectedValue(new Error('network down'));
    render(<ProcessRegisterSummary />);

    await waitFor(() =>
      expect(screen.getByText('Não foi possível carregar os indicadores.')).toBeInTheDocument(),
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
