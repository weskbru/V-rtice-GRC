import { ConfirmDialog } from '@pharos/design-system/components';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';

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
