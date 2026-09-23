import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCurrentValueMock } = vi.hoisted(() => ({ getCurrentValueMock: vi.fn() }));

vi.mock('@/features/indicators/api', () => ({
  indicatorsApi: { getCurrentValue: getCurrentValueMock },
}));

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { IndicatorDetailView } from './indicator-detail-view';

beforeEach(() => {
  getCurrentValueMock.mockReset();
});

function renderDetail(scopeGlobal: boolean): void {
  render(
    <AuthProvider
      initialSession={buildTestSession({ scope: { global: scopeGlobal, orgUnitIds: ['org-1'] } })}
    >
      <IndicatorDetailView metricKey="COMPLIANCE_PERCENTAGE" />
    </AuthProvider>,
  );
}

describe('IndicatorDetailView scope label', () => {
  it('labels an ORGANIZATION_WIDE metric "Organização inteira" even for a UNIT-scoped caller', async () => {
    getCurrentValueMock.mockResolvedValue({
      metricKey: 'COMPLIANCE_PERCENTAGE',
      shape: 'SINGLE_VALUE',
      scopeApplicability: 'ORGANIZATION_WIDE',
      value: 0,
      valueByBucket: null,
      definition: null,
      computedAt: '2026-09-12T14:32:00.000Z',
    });

    renderDetail(false);

    expect(await screen.findByText('Escopo: Organização inteira')).toBeInTheDocument();
    expect(
      screen.queryByText('Escopo: Unidades organizacionais do seu escopo'),
    ).not.toBeInTheDocument();
  });

  it("labels an ORGANIZATIONAL_UNIT metric by the caller's own scope", async () => {
    getCurrentValueMock.mockResolvedValue({
      metricKey: 'COMPLIANCE_PERCENTAGE',
      shape: 'SINGLE_VALUE',
      scopeApplicability: 'ORGANIZATIONAL_UNIT',
      value: 0,
      valueByBucket: null,
      definition: null,
      computedAt: '2026-09-12T14:32:00.000Z',
    });

    renderDetail(false);

    expect(
      await screen.findByText('Escopo: Unidades organizacionais do seu escopo'),
    ).toBeInTheDocument();
  });
});
