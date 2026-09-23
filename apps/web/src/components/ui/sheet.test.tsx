import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { common } from '@/lib/messages/common';


function SheetHarness(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir painel
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle>Detalhe do papel</SheetTitle>
          <SheetDescription>Permissões concedidas.</SheetDescription>
          <textarea autoFocus aria-label="Observação" />
          <button type="button" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MenuOpenedSheetHarness(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Ações</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setOpen(true)}>Ver detalhes</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetTitle>Detalhe do papel</SheetTitle>
          <SheetDescription>Permissões concedidas.</SheetDescription>
          <button type="button" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}

describe('SheetContent — focus restoration (T002)', () => {
  it("restores focus to the trigger — not the sheet's own autoFocus field — after closing with Escape", async () => {
    render(<SheetHarness />);
    const trigger = screen.getByRole('button', { name: 'Abrir painel' });

    trigger.focus();
    fireEvent.click(trigger);
    const field = await screen.findByLabelText('Observação');
    await waitFor(() => expect(document.activeElement).toBe(field));

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('Observação')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('restores focus to the trigger after closing with the sheet\'s own X button', async () => {
    render(<SheetHarness />);
    const trigger = screen.getByRole('button', { name: 'Abrir painel' });

    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByLabelText('Observação');

    fireEvent.click(screen.getByRole('button', { name: common.dialog.closeLabel }));
    await waitFor(() => expect(screen.queryByLabelText('Observação')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('restores focus to the trigger after closing with a Cancelar button', async () => {
    render(<SheetHarness />);
    const trigger = screen.getByRole('button', { name: 'Abrir painel' });

    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByLabelText('Observação');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByLabelText('Observação')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("resolves a menu-opened sheet's restore target to the MENU TRIGGER, not the menu item that unmounts underneath it", async () => {
    render(<MenuOpenedSheetHarness />);
    const menuTrigger = screen.getByRole('button', { name: 'Ações' });

    fireEvent.pointerDown(menuTrigger);
    const menu = await screen.findByRole('menu');
    const item = await screen.findByRole('menuitem', { name: 'Ver detalhes' });
    item.focus();

    fireEvent.click(item);
    await screen.findByRole('heading', { name: 'Detalhe do papel' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Detalhe do papel' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(document.activeElement).toBe(menuTrigger));

    expect(menu).not.toBeInTheDocument();
  });
});

describe('SheetContent — D-15 preservation', () => {
  it("names the close control from the pt-BR catalogue, never a hardcoded English string", async () => {
    render(<SheetHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir painel' }));

    const close = await screen.findByRole('button', { name: common.dialog.closeLabel });
    expect(close).toBeInTheDocument();
    expect(common.dialog.closeLabel).not.toBe('Close');
  });
});
