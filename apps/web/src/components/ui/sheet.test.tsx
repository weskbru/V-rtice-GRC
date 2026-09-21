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

/**
 * T002 (015-roles-permissions-surface) — `SheetContent` focus restoration,
 * the exact counterpart of `dialog.test.tsx`'s S-03 coverage.
 *
 * `Sheet` is built on the same `@radix-ui/react-dialog` primitive as
 * `Dialog`, and inherited the same defect: modal content hard-codes
 * `onCloseAutoFocus` to focus a registered `Sheet.Trigger`, and its
 * `preventDefault()` also discards `FocusScope`'s generic "restore whatever
 * had focus before" fallback. No caller in this platform renders a Radix
 * trigger, so nothing was registered and focus fell to `<body>` on every
 * close — WCAG SC 2.4.3. This is the measured impediment that made 012 §2.4
 * choose `Dialog` over `Sheet`; these tests are what keep it removed.
 *
 * Non-vacuity: delete the `<FocusRestoreAnchor …/>` line from `sheet.tsx`
 * and all four tests below fail with `document.activeElement` = `<body>`.
 */

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
          {/* The autoFocus pattern that defeated the previous, commit-phase
              capture in `dialog.tsx` (S-03 (a)) — reproduced here so the
              sheet cannot regress into it either. */}
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

    // `fireEvent.click` does not move focus by itself the way a real
    // activation does; focusing first is what makes the precondition this
    // test protects (the real trigger had focus) actually hold.
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

    // The menu was gone long before the sheet closed — so this could only
    // have worked by resolving the trigger at CAPTURE time.
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
