import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DashboardToday } from './dashboard-today';

describe('DashboardToday', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the reader’s date in pt-BR, sentence-cased', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 12, 10, 0, 0));

    const { container } = render(<DashboardToday />);

    expect(container.textContent).toBe('Sábado, 12 de setembro de 2026');
  });
});
