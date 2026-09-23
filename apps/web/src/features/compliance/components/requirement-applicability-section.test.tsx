import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequirementApplicabilitySection } from './requirement-applicability-section';

import type { RequirementApplicability } from '../types';

const {
  listRequirementControlLinksMock,
  listRequirementApplicabilityDeclarationsMock,
  declareRequirementNotApplicableMock,
  revokeRequirementApplicabilityDeclarationMock,
} = vi.hoisted(() => ({
  listRequirementControlLinksMock: vi.fn(),
  listRequirementApplicabilityDeclarationsMock: vi.fn(),
  declareRequirementNotApplicableMock: vi.fn(),
  revokeRequirementApplicabilityDeclarationMock: vi.fn(),
}));

vi.mock('../api', () => ({
  complianceApi: {
    listRequirementControlLinks: listRequirementControlLinksMock,
    listRequirementApplicabilityDeclarations: listRequirementApplicabilityDeclarationsMock,
    declareRequirementNotApplicable: declareRequirementNotApplicableMock,
    revokeRequirementApplicabilityDeclaration: revokeRequirementApplicabilityDeclarationMock,
  },
}));

const declaredBy = { id: 'user-1', fullName: 'Ana Souza' };

function declarationFixture(
  overrides: Partial<RequirementApplicability>,
): RequirementApplicability {
  return {
    id: 'decl-1',
    justification: 'Não se aplica a esta organização.',
    declaredBy,
    declaredAt: '2026-01-05T00:00:00.000Z',
    revokedBy: null,
    revokedAt: null,
    ...overrides,
  };
}

describe('RequirementApplicabilitySection', () => {
  beforeEach(() => {
    listRequirementControlLinksMock.mockReset();
    listRequirementApplicabilityDeclarationsMock.mockReset();
    declareRequirementNotApplicableMock.mockReset();
    revokeRequirementApplicabilityDeclarationMock.mockReset();
    listRequirementControlLinksMock.mockResolvedValue([]);
  });

  it('states plainly that the clause is applicable by default when no declaration is active', async () => {
    listRequirementApplicabilityDeclarationsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    });

    render(
      <RequirementApplicabilitySection
        requirementId="req-1"
        canAdminister={false}
        onChanged={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Esta cláusula é aplicável \(padrão\)/)).toBeInTheDocument();
    expect(
      screen.getByText('Nenhuma declaração de não aplicável foi registrada para esta cláusula.'),
    ).toBeInTheDocument();
  });

  it('shows the active declaration plainly, with its exclusion from the compliance calculation stated', async () => {
    listRequirementApplicabilityDeclarationsMock.mockResolvedValue({
      data: [declarationFixture({})],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });

    render(
      <RequirementApplicabilitySection
        requirementId="req-1"
        canAdminister={false}
        onChanged={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/não entra no cálculo de conformidade da versão/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Não se aplica a esta organização\./).length).toBeGreaterThan(0);
  });

  it('shows the "kept but excluded" notice when a non-applicable clause still has a control link (edge case)', async () => {
    listRequirementApplicabilityDeclarationsMock.mockResolvedValue({
      data: [declarationFixture({})],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    listRequirementControlLinksMock.mockResolvedValue([
      {
        id: 'link-1',
        control: { id: 'control-1', code: 'CTL-001', name: 'Controle X' },
        linkedBy: declaredBy,
        linkedAt: '2026-01-01T00:00:00.000Z',
        unlinkedBy: null,
        unlinkedAt: null,
      },
    ]);

    render(
      <RequirementApplicabilitySection
        requirementId="req-1"
        canAdminister={false}
        onChanged={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(
        /o vínculo é mantido porque a organização pode ter o controle por outra razão/,
      ),
    ).toBeInTheDocument();
  });

  it('requires a justification before declaring not applicable (FR-015)', async () => {
    listRequirementApplicabilityDeclarationsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    });

    render(
      <RequirementApplicabilitySection requirementId="req-1" canAdminister onChanged={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Declarar não aplicável' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Declarar não aplicável' }));

    expect(await screen.findByText('Informe a justificativa.')).toBeInTheDocument();
    expect(declareRequirementNotApplicableMock).not.toHaveBeenCalled();
  });

  it('declares not applicable with a justification and reports the change upward', async () => {
    listRequirementApplicabilityDeclarationsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    });
    declareRequirementNotApplicableMock.mockResolvedValue(declarationFixture({}));
    const onChanged = vi.fn();

    render(
      <RequirementApplicabilitySection requirementId="req-1" canAdminister onChanged={onChanged} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Declarar não aplicável' }));
    fireEvent.change(await screen.findByLabelText(/^Justificativa/), {
      target: { value: 'Não se aplica.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Declarar não aplicável' }));

    await waitFor(() =>
      expect(declareRequirementNotApplicableMock).toHaveBeenCalledWith('req-1', {
        justification: 'Não se aplica.',
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('revokes the active declaration after confirmation', async () => {
    listRequirementApplicabilityDeclarationsMock.mockResolvedValue({
      data: [declarationFixture({})],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    revokeRequirementApplicabilityDeclarationMock.mockResolvedValue(undefined);
    const onChanged = vi.fn();

    render(
      <RequirementApplicabilitySection requirementId="req-1" canAdminister onChanged={onChanged} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Revogar declaração' }));
    await screen.findByText('Revogar esta declaração?');
    fireEvent.click(screen.getByRole('button', { name: 'Revogar declaração' }));

    await waitFor(() =>
      expect(revokeRequirementApplicabilityDeclarationMock).toHaveBeenCalledWith('req-1', 'decl-1'),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
