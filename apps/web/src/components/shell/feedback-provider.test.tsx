import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FeedbackProvider, feedback } from './feedback-provider';

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
