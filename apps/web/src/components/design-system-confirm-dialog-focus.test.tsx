import { ConfirmDialog } from '@pharos/design-system/components';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';

/**
 * S-04 regression coverage (F-62). `ConfirmDialog` (34 callers) had no
 * focus-restoration handling of its own until this fix — every close threw
 * focus to `<body>`, made worse by its confirm button's own `autoFocus`
 * racing the (missing) capture exactly like `apps/web/src/components/ui/dialog.tsx`
 * (D-15) already had to solve. This asserts the SAME
 * `useDialogFocusRestore` mechanism (`packages/design-system/src/lib/use-restore-focus.ts`)
 * is wired into `ConfirmDialog` too.
 */

function Harness(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Encerrar sessões
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Encerrar todas as sessões?"
        description="O usuário precisará entrar novamente em todos os dispositivos."
        variant="sensitive"
        labels={{
          confirm: 'Encerrar',
          cancel: common.confirmDialog.cancel,
          close: common.confirmDialog.close,
        }}
        onConfirm={() => setOpen(false)}
      />
    </div>
  );
}

describe('ConfirmDialog — focus restoration (S-04)', () => {
  it("restores focus to the trigger — not the confirm button's own autoFocus — on Escape, without confirming", async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Encerrar sessões' });

    trigger.focus();
    fireEvent.click(trigger);

    const confirmButton = await screen.findByRole('button', { name: 'Encerrar' });
    // The confirm button carries `autoFocus` — this is the exact race S-04
    // protects against: the captured "previous" element must still resolve
    // to the real trigger, never to this button.
    await waitFor(() => expect(document.activeElement).toBe(confirmButton));

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByText('Encerrar todas as sessões?')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('restores focus to the trigger on Cancelar', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Encerrar sessões' });

    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('button', { name: 'Encerrar' });

    fireEvent.click(screen.getByRole('button', { name: common.confirmDialog.cancel }));
    await waitFor(() =>
      expect(screen.queryByText('Encerrar todas as sessões?')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
