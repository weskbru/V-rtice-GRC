import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeedbackProvider, feedback } from './feedback-provider';

/**
 * Regression coverage for the `sonner` default-English fix (CLAUDE.md
 * §11.1): `closeButtonAriaLabel` defaults to `'Close toast'` and
 * `containerAriaLabel` to `'Notifications'` in `sonner`'s own source —
 * both real, documented props, overridden once at this provider's
 * `<Toaster>` call site (`common.toaster`) so every `feedback.*` call in
 * the application inherits pt-BR labels, never the dependency's own
 * English default. Mirrors the same class of fix `common.ts`'s own
 * `dialog.closeLabel`/`commandPalette` doc comments record for the shadcn
 * primitives (T203).
 */
describe('FeedbackProvider', () => {
  it('labels the notification region and every toast close button in pt-BR, never the sonner default', async () => {
    render(
      <FeedbackProvider>
        <div>conteúdo</div>
      </FeedbackProvider>,
    );

    feedback.success('Operação concluída.');

    expect(await screen.findByText('Operação concluída.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar notificação' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close toast' })).not.toBeInTheDocument();

    const region = document.querySelector('[aria-label^="Notificações"]');
    expect(region).not.toBeNull();
    expect(document.querySelector('[aria-label^="Notifications"]')).toBeNull();
  });
});
