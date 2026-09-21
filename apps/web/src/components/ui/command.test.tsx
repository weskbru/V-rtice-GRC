import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';

import { CommandDialog } from './command';

/**
 * Assurance-audit Fix 4: `CommandDialog`'s `title`/`description` defaults
 * used to be the shadcn scaffold's own hardcoded English strings ("Command
 * Palette" / "Search for a command to run..."), never localized
 * (CLAUDE.md §11.1). This primitive has zero importers anywhere in the app
 * today — dormant, not currently reachable by any user — so unlike every
 * other fix in this pass, no existing consumer test could exercise it;
 * this is the only thing that would fail if its defaults regressed back to
 * English.
 */
describe('CommandDialog', () => {
  it('defaults its title and accessible description to pt-BR, never the shadcn scaffold\'s English text', () => {
    render(
      <CommandDialog open>
        <p>conteúdo</p>
      </CommandDialog>,
    );

    // `getByText`, not `getByRole('heading', ...)`: this component renders
    // `DialogTitle`/`DialogDescription` as SIBLINGS of `DialogContent`
    // (cross-referenced via `aria-labelledby`/`aria-describedby`) rather
    // than nested inside it, which puts them outside the subtree Radix's
    // own focus-trap treats as "the dialog" — `aria-hidden` ends up on
    // their wrapper as a side effect, a pre-existing property of this
    // dormant component's own markup, unrelated to the string-default fix
    // under test here. `getByText` finds them regardless, exactly like a
    // sighted user reading the (visually `sr-only` but rendered) text would.
    expect(screen.getByText(common.commandPalette.defaultTitle, { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText(common.commandPalette.defaultDescription)).toBeInTheDocument();
    expect(screen.queryByText('Command Palette')).not.toBeInTheDocument();
    expect(screen.queryByText(/Search for a command/)).not.toBeInTheDocument();
  });
});
