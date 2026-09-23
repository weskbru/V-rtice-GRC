import { DataTable } from '@pharos/design-system/components';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { ColumnDef } from '@pharos/design-system/components';

import { common } from '@/lib/messages/common';


interface Row {
  id: string;
  name: string;
}

function noop(): void {
}

function Harness(): React.JSX.Element {
  const [clicks, setClicks] = useState(0);

  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: 'name',
      header: () => 'Nome',
      cell: ({ row }) => (
        <button type="button" onClick={() => setClicks((c) => c + 1)}>
          {row.original.name}
        </button>
      ),
    },
  ];

  return (
    <div>
      <DataTable
        columns={columns}
        data={[{ id: '1', name: 'Linha 1' }]}
        sorting={[]}
        onSortingChange={noop}
        pageIndex={0}
        pageSize={25}
        totalRows={1}
        onPageIndexChange={noop}
        onPageSizeChange={noop}
        labels={common.dataTable}
      />
      <span data-testid="clicks">{clicks}</span>
    </div>
  );
}

describe('DataTable — cell render-function identity (S-05)', () => {
  it('keeps the SAME cell DOM node — and its focus — across a parent re-render that rebuilds columns with new function identities', () => {
    render(<Harness />);

    const buttonBefore = screen.getByRole('button', { name: 'Linha 1' });
    buttonBefore.focus();
    expect(document.activeElement).toBe(buttonBefore);

    fireEvent.click(buttonBefore);
    expect(screen.getByTestId('clicks')).toHaveTextContent('1');

    const buttonAfter = screen.getByRole('button', { name: 'Linha 1' });
    expect(buttonAfter).toBe(buttonBefore);
    expect(document.activeElement).toBe(buttonAfter);
  });
});
