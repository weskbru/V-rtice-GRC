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

    expect(menu).not.toBeInTheDocument();
  });
});
