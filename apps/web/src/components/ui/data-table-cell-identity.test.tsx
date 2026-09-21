import { DataTable } from '@pharos/design-system/components';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { ColumnDef } from '@pharos/design-system/components';

import { common } from '@/lib/messages/common';

/**
 * S-05 regression coverage. `DataTable` must render `cell`/`header` as
 * render functions, not mount them as components — otherwise a caller that
 * rebuilds its `columns` array on every render (the norm across this
 * codebase: `buildXColumns(...)` is called directly in the component body,
 * with no `useMemo`, in every register/list screen except three) hands
 * `flexRender` a NEW function identity for `cell` each time, which
 * `flexRender` treats as an entirely new component TYPE and remounts —
 * discarding whatever DOM node inside that cell currently held keyboard
 * focus (e.g. a row's "⋮" menu trigger). A dialog opened from that trigger
 * then "restores" focus to a node that no longer exists, and it silently
 * falls to `<body>`.
 *
 * This deliberately never memoizes `columns` in the harness below — that is
 * the exact real-world shape (10 of 13 `DataTable` call sites in
 * `apps/web`) this fix protects, not an artificial worst case.
 */

interface Row {
  id: string;
  name: string;
}

function noop(): void {
  // Intentionally empty — the harness below never reads these callbacks'
  // arguments; `DataTable` requires them regardless.
}

function Harness(): React.JSX.Element {
  const [clicks, setClicks] = useState(0);

  // Deliberately rebuilt every render, with a brand-new `cell` function
  // identity each time — no `useMemo`. This is the pattern S-05 found in
  // 10 of 13 `DataTable` callers.
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

    // Triggers a state update in the harness, which rebuilds `columns` (and
    // therefore `cell`) with fresh function identities on the next render —
    // exactly the scenario that remounted every cell before this fix.
    fireEvent.click(buttonBefore);
    expect(screen.getByTestId('clicks')).toHaveTextContent('1');

    const buttonAfter = screen.getByRole('button', { name: 'Linha 1' });
    expect(buttonAfter).toBe(buttonBefore);
    expect(document.activeElement).toBe(buttonAfter);
  });
});
