import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component-mount evidence for `IndicatorDetailView`'s scope label (S-07, `A4-F01`): an
 * `ORGANIZATION_WIDE` metric (`COMPLIANCE_PERCENTAGE` today) must read "Organização inteira" even
 * for a caller whose OWN `EffectiveScope.global` is `false` — the metric's own business rule, not
 * the caller's scope, decides this label. Before the fix, `metricScopeLabel` took only the
 * caller's `scope.global` and this exact fixture rendered "Escopo: Sua unidade organizacional".
 *
 * The non-global label itself is "Unidades organizacionais do seu escopo" (plural/count-free),
 * never "Sua unidade organizacional" (singular) — `EffectiveScope.orgUnitIds` is an array and can
 * genuinely hold more than one id (several grants, or one grant expanded to its descendants,
 * FR-025b) — see `indicators.register.scopeLabel`'s own doc comment for the full evidence.
 */
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
