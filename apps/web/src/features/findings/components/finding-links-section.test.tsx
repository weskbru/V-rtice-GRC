import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FindingLinksSection } from './finding-links-section';

/**
 * Component-mount evidence for T078 (`FindingLinksSection`,
 * 005-audit-findings, US3, FR-013 to FR-016, ADR-020, FR-012/SC-005). `../api`
 * is mocked at the network boundary, mirroring `finding-close-dialog
 * .test.tsx`'s own pattern.
 */

const {
  listControlLinksMock,
  listRiskLinksMock,
  listControlOptionsMock,
  listRiskOptionsMock,
  linkControlMock,
  unlinkControlMock,
  linkRiskMock,
  unlinkRiskMock,
} = vi.hoisted(() => ({
  listControlLinksMock: vi.fn(),
  listRiskLinksMock: vi.fn(),
  listControlOptionsMock: vi.fn(),
  listRiskOptionsMock: vi.fn(),
  linkControlMock: vi.fn(),
  unlinkControlMock: vi.fn(),
  linkRiskMock: vi.fn(),
  unlinkRiskMock: vi.fn(),
}));

vi.mock('../api', () => ({
  findingsApi: {
    listControlLinks: listControlLinksMock,
    listRiskLinks: listRiskLinksMock,
    listControlOptions: listControlOptionsMock,
    listRiskOptions: listRiskOptionsMock,
    linkControl: linkControlMock,
    unlinkControl: unlinkControlMock,
    linkRisk: linkRiskMock,
    unlinkRisk: unlinkRiskMock,
  },
}));

beforeEach(() => {
  listControlLinksMock.mockReset();
  listRiskLinksMock.mockReset();
  listControlOptionsMock.mockReset();
  listRiskOptionsMock.mockReset();
  linkControlMock.mockReset();
  unlinkControlMock.mockReset();
  linkRiskMock.mockReset();
  unlinkRiskMock.mockReset();
  listControlLinksMock.mockResolvedValue([]);
  listRiskLinksMock.mockResolvedValue([]);
  listControlOptionsMock.mockResolvedValue({ data: [], isPartial: false });
  listRiskOptionsMock.mockResolvedValue({ data: [], isPartial: false });
});

describe('FindingLinksSection', () => {
  it('shows the empty state for both relationships when none exist yet', async () => {
    render(
      <FindingLinksSection findingId="finding-1" findingStatus="OPEN" canLinkPermission={false} />,
    );

    await screen.findByText('Nenhum controle vinculado a este achado.');
    await screen.findByText('Nenhum risco vinculado a este achado.');
  });

  it('links a control through the picker, calling the finding-scoped endpoint', async () => {
    listControlOptionsMock.mockResolvedValue({
      data: [{ id: 'control-1', code: 'CTL-0001', name: 'Segregação de acessos' }],
      isPartial: false,
    });
    linkControlMock.mockResolvedValue({
      id: 'link-1',
      control: { id: 'control-1', code: 'CTL-0001', name: 'Segregação de acessos' },
      linkedAt: '2026-03-01T00:00:00.000Z',
      linkedBy: { id: 'user-1', fullName: 'Ana Souza' },
      unlinkedAt: null,
      unlinkedBy: null,
    });

    render(
      <FindingLinksSection findingId="finding-1" findingStatus="OPEN" canLinkPermission={true} />,
    );

    // The picker's own trigger accessible name is `pickerAriaLabel`
    // ("Selecionar controle"), and it searches server-side as the user
    // types (Front H) — see the identical fix in the e2e specs and in
    // `risk-controls-section.test.tsx`/`requirement-controls-section.test.tsx`.
    fireEvent.click(await screen.findByRole('combobox', { name: 'Selecionar controle' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar controle por nome ou código'), {
      target: { value: 'segregação' },
    });
    fireEvent.click(await screen.findByRole('option', { name: /Segregação de acessos/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Vincular controle' }));

    await waitFor(() =>
      expect(linkControlMock).toHaveBeenCalledWith('finding-1', { controlId: 'control-1' }),
    );
  });

  it('withdraws a link — reads as "desvincular", never "excluir", and preserves the row', async () => {
    listControlLinksMock.mockResolvedValue([
      {
        id: 'link-1',
        control: { id: 'control-1', code: 'CTL-0001', name: 'Segregação de acessos' },
        linkedAt: '2026-03-01T00:00:00.000Z',
        linkedBy: { id: 'user-1', fullName: 'Ana Souza' },
        unlinkedAt: null,
        unlinkedBy: null,
      },
    ]);
    unlinkControlMock.mockResolvedValue({
      id: 'link-1',
      control: { id: 'control-1', code: 'CTL-0001', name: 'Segregação de acessos' },
      linkedAt: '2026-03-01T00:00:00.000Z',
      linkedBy: { id: 'user-1', fullName: 'Ana Souza' },
      unlinkedAt: '2026-03-02T00:00:00.000Z',
      unlinkedBy: { id: 'user-2', fullName: 'Bruno Lima' },
    });

    render(
      <FindingLinksSection findingId="finding-1" findingStatus="OPEN" canLinkPermission={true} />,
    );

    await screen.findByText('Segregação de acessos');
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular' }));

    const dialog = await screen.findByRole('dialog');
    // Never "excluir"/"remover permanentemente" anywhere in this confirmation.
    expect(within(dialog).queryByText(/excluir/i)).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/não é apagado: ele continua registrado no histórico/i),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Desvincular' }));

    await waitFor(() => expect(unlinkControlMock).toHaveBeenCalledWith('finding-1', 'link-1'));
  });

  it('shows the proactive archived notice and hides both pickers for an ARCHIVED finding', async () => {
    render(
      <FindingLinksSection
        findingId="finding-1"
        findingStatus="ARCHIVED"
        canLinkPermission={true}
      />,
    );

    await screen.findByText('Um achado arquivado não aceita novos vínculos.');
    expect(screen.queryByLabelText('Vincular controle')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Vincular risco')).not.toBeInTheDocument();
  });
});

/**
 * S-08 (`F-61`, `A4-F05`) — `FindingsPanel` mounts one `FindingLinksSection`
 * per finding, and this section used to fetch its controls AND its risks the
 * instant it mounted, regardless of whether the finding was ever scrolled
 * into view. Measured against a populous org unit this produced 150-350
 * requests on a single page load. These tests stub a real
 * `IntersectionObserver` (this project's own Vitest/jsdom setup polyfills
 * only `ResizeObserver` — see `vitest.setup.ts` — so every OTHER test in
 * this file already exercises this component's fallback path, not a mocked
 * "always intersecting" observer) to prove the fetch is genuinely gated on
 * intersection, not merely delayed.
 */
describe('FindingLinksSection viewport gating (S-08)', () => {
  let observed: { callback: IntersectionObserverCallback; element: Element } | null;
  // Only `observe`'s recorded callback is ever exercised — the rest of the
  // real `IntersectionObserver` interface is unused surface this fake must
  // still implement to type-check as one.
  /* eslint-disable @typescript-eslint/no-empty-function -- deliberate no-op stub methods, not a mistake */
  class FakeIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: readonly number[] = [];
    private readonly callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe(element: Element): void {
      observed = { callback: this.callback, element };
    }
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  /* eslint-enable @typescript-eslint/no-empty-function */

  // The hook's own observer callback never reads its second (`observer`)
  // argument, so every simulated intersection below reuses this one stub
  // instance rather than constructing a fresh, unused `FakeIntersectionObserver`.
  const unusedObserverArg = new FakeIntersectionObserver(() => undefined);

  beforeEach(() => {
    observed = null;
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers an observer and fetches NEITHER relationship before the section intersects', async () => {
    render(
      <FindingLinksSection findingId="finding-1" findingStatus="OPEN" canLinkPermission={false} />,
    );

    // Let the mount effect run (it registers the observer synchronously).
    await Promise.resolve();
    expect(observed).not.toBeNull();
    expect(listControlLinksMock).not.toHaveBeenCalled();
    expect(listRiskLinksMock).not.toHaveBeenCalled();
    // The pending state reads the same as "loading" — no distinct empty/error state before intersection.
    expect(screen.getByText('Carregando controles vinculados…')).toBeInTheDocument();
    expect(screen.getByText('Carregando riscos vinculados…')).toBeInTheDocument();
  });

  it('fetches both relationships once the section intersects the viewport', async () => {
    render(
      <FindingLinksSection findingId="finding-1" findingStatus="OPEN" canLinkPermission={false} />,
    );

    await Promise.resolve();
    expect(observed).not.toBeNull();

    observed?.callback([{ isIntersecting: true } as IntersectionObserverEntry], unusedObserverArg);

    await waitFor(() => expect(listControlLinksMock).toHaveBeenCalledWith('finding-1', false));
    await waitFor(() => expect(listRiskLinksMock).toHaveBeenCalledWith('finding-1', false));
  });

  it('never re-fetches once active, even if intersection is reported again', async () => {
    render(
      <FindingLinksSection findingId="finding-1" findingStatus="OPEN" canLinkPermission={false} />,
    );
    await Promise.resolve();

    observed?.callback([{ isIntersecting: true } as IntersectionObserverEntry], unusedObserverArg);
    await waitFor(() => expect(listControlLinksMock).toHaveBeenCalledTimes(1));

    observed?.callback([{ isIntersecting: true } as IntersectionObserverEntry], unusedObserverArg);
    await Promise.resolve();
    expect(listControlLinksMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to fetching immediately when IntersectionObserver does not exist', async () => {
    vi.unstubAllGlobals();
    const original = window.IntersectionObserver;
    // @ts-expect-error -- simulating an environment without IntersectionObserver (older browsers)
    delete window.IntersectionObserver;

    try {
      render(
        <FindingLinksSection
          findingId="finding-1"
          findingStatus="OPEN"
          canLinkPermission={false}
        />,
      );

      await waitFor(() => expect(listControlLinksMock).toHaveBeenCalledWith('finding-1', false));
      await waitFor(() => expect(listRiskLinksMock).toHaveBeenCalledWith('finding-1', false));
    } finally {
      window.IntersectionObserver = original;
    }
  });
});
