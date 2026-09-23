import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';

import { CommandDialog } from './command';

describe('CommandDialog', () => {
  it('defaults its title and accessible description to pt-BR, never the shadcn scaffold\'s English text', () => {
    render(
      <CommandDialog open>
        <p>conteúdo</p>
      </CommandDialog>,
    );

    expect(screen.getByText(common.commandPalette.defaultTitle, { selector: 'h2' })).toBeInTheDocument();
    expect(screen.getByText(common.commandPalette.defaultDescription)).toBeInTheDocument();
    expect(screen.queryByText('Command Palette')).not.toBeInTheDocument();
    expect(screen.queryByText(/Search for a command/)).not.toBeInTheDocument();
  });
});
