import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * S-03 regression coverage (D-15 update, `docs/local-environment.md`).
 * `DialogContent` used to capture the element to restore focus to in
 * Radix's `onOpenAutoFocus`, which fires AFTER commit — too late for two
 * real patterns in this codebase:
 *
 * (a) a native `autoFocus` on a field inside the dialog moves focus onto
 *     that field during commit, before `onOpenAutoFocus` ran, so the
 *     "previous" element captured was the dialog's OWN field, not the
 *     trigger — gone once the dialog closes, so focus fell to `<body>`;
 * (b) a dialog opened from a `DropdownMenuItem`'s `onSelect` captured the
 *     menu ITEM, which unmounts during the menu's own exit animation, so
 *     the restore target no longer existed at close time either.
 */

function AutoFocusFieldHarness(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Reabrir
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Reabrir ação</DialogTitle>
          <DialogDescription>Descreva o motivo.</DialogDescription>
          {/* Reproduces the exact pattern (`ReopenActionDialog`'s `<Textarea autoFocus>`) this test protects. */}
          <textarea autoFocus aria-label="Motivo" />
          <button type="button" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MenuOpenedDialogHarness(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Ações</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {/* Deliberately the historical, unfixed pattern (opens straight from
              onSelect, not deferred to the menu's own onCloseAutoFocus) — this
              test asserts `DialogContent` itself is now safe against it. */}
          <DropdownMenuItem onSelect={() => setOpen(true)}>Editar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Editar</DialogTitle>
          <DialogDescription>Formulário de edição.</DialogDescription>
          <button type="button" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

describe('DialogContent — focus restoration (S-03)', () => {
  it("restores focus to the trigger — not the dialog's own autoFocus field — after closing with Escape", async () => {
    render(<AutoFocusFieldHarness />);
    const trigger = screen.getByRole('button', { name: 'Reabrir' });

    // `fireEvent.click` (unlike a real browser click) does not itself move
    // focus onto the clicked element — focus it explicitly first, matching
    // what a real mouse or keyboard activation always does, so the
    // precondition this test protects (the dialog's real trigger has focus
    // right before it opens) is actually exercised.
    trigger.focus();
    fireEvent.click(trigger);
    const field = await screen.findByLabelText('Motivo');
    await waitFor(() => expect(document.activeElement).toBe(field));

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('Motivo')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("restores focus to the trigger — not the dialog's own autoFocus field — after closing with the Cancelar button", async () => {
    render(<AutoFocusFieldHarness />);
    const trigger = screen.getByRole('button', { name: 'Reabrir' });

    trigger.focus();
    fireEvent.click(trigger);
    const field = await screen.findByLabelText('Motivo');
    await waitFor(() => expect(document.activeElement).toBe(field));

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByLabelText('Motivo')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("resolves a menu-opened dialog's restore target to the MENU TRIGGER, not the menu item that closes/unmounts underneath it", async () => {
    render(<MenuOpenedDialogHarness />);
    const menuTrigger = screen.getByRole('button', { name: 'Ações' });

    fireEvent.pointerDown(menuTrigger);
    const menu = await screen.findByRole('menu');
    const editItem = await screen.findByRole('menuitem', { name: 'Editar' });
    editItem.focus();

    fireEvent.click(editItem);
    await screen.findByRole('heading', { name: 'Editar' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Editar' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(document.activeElement).toBe(menuTrigger));

    // The menu itself is long gone by the time the dialog closed — proving
    // this could only have worked by resolving the trigger EARLY (at
    // capture time), not by looking the menu item up again at close time.
    expect(menu).not.toBeInTheDocument();
  });
});
