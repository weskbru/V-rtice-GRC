import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { EvidenceCreateDialog } from './evidence-create-dialog';

/**
 * S-10 (`specs/013-stabilization-audit`) — the "Responsável" field became a
 * server-searched `UserPicker`, which displays its own `owner` state rather
 * than the form value. Closing the dialog runs `form.reset()`; before the
 * reset also restored `owner`, reopening the dialog showed the PREVIOUS pick
 * while the form would submit the default owner — the same shape existed in
 * `FindingCreateDialog` and `EngagementFindingCreateDialog`, fixed identically.
 */

const { searchUsersMock } = vi.hoisted(() => ({ searchUsersMock: vi.fn() }));

vi.mock('../api', () => ({
  evidenceApi: {
    searchUsers: searchUsersMock,
    createEvidence: vi.fn(),
    linkEvidence: vi.fn(),
    uploadAttachment: vi.fn(),
  },
}));

const OTHER_USER = { id: 'user-2', fullName: 'Bruno Lima', email: 'bruno@pharosgrc.local' };

function Harness(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <EvidenceCreateDialog
        open={open}
        onOpenChange={setOpen}
        orgUnitId="org-1"
        subjectType="RISK"
        subjectId="risk-1"
        defaultOwnerUserId="user-1"
        onCreated={vi.fn()}
      />
    </>
  );
}

beforeEach(() => {
  searchUsersMock.mockReset();
  searchUsersMock.mockResolvedValue({ data: [OTHER_USER], isPartial: false });
});

describe('EvidenceCreateDialog — responsible picker (S-10)', () => {
  it('shows the default owner again after a different pick is discarded by closing the dialog', async () => {
    render(
      <AuthProvider initialSession={buildTestSession({ permissions: [] })}>
        <Harness />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const trigger = await screen.findByRole('combobox', { name: 'Responsável' });
    expect(trigger).toHaveTextContent('Ada Analyst');

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('option', { name: /^Bruno Lima/ }));
    expect(screen.getByRole('combobox', { name: 'Responsável' })).toHaveTextContent('Bruno Lima');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(await screen.findByRole('combobox', { name: 'Responsável' })).toHaveTextContent(
      'Ada Analyst',
    );
  });
});
