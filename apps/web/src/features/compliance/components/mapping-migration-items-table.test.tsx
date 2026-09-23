import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MappingMigrationItemsTable } from './mapping-migration-items-table';

import type { MappingMigrationItem } from '../types';

function itemFixture(overrides: Partial<MappingMigrationItem>): MappingMigrationItem {
  return {
    targetRequirement: { id: 'req-2', externalRef: 'A.5.1', title: 'Política de segurança' },
    sourceRequirements: [
      { id: 'req-1', externalRef: 'A.5.1', title: 'Política de segurança (2019)' },
    ],
    outcome: 'COPIED',
    copiedLinkCount: 2,
    ...overrides,
  };
}

describe('MappingMigrationItemsTable', () => {
  it('renders a COPIED item with its source and copied link count', () => {
    render(<MappingMigrationItemsTable items={[itemFixture({})]} />);

    expect(screen.getByText('Política de segurança')).toBeInTheDocument();
    expect(screen.getAllByText('A.5.1').length).toBeGreaterThan(0);
    expect(screen.getByText('Transportado')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders PENDING_DECISION distinctly, with no source and zero copied links', () => {
    render(
      <MappingMigrationItemsTable
        items={[
          itemFixture({
            targetRequirement: { id: 'req-3', externalRef: 'A.6.1', title: 'Controle de acesso' },
            sourceRequirements: [],
            outcome: 'PENDING_DECISION',
            copiedLinkCount: 0,
          }),
        ]}
      />,
    );

    expect(screen.getByText('Pendente de decisão')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders SKIPPED_ALREADY_MAPPED distinctly from both other outcomes', () => {
    render(
      <MappingMigrationItemsTable
        items={[itemFixture({ outcome: 'SKIPPED_ALREADY_MAPPED', copiedLinkCount: 0 })]}
      />,
    );

    expect(screen.getByText('Já tinha mapeamento próprio')).toBeInTheDocument();
  });
});
