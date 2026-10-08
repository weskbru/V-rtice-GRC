import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IndicatorOverviewError } from './indicator-overview-error';

describe('IndicatorOverviewError', () => {
  it('explains that the indicators could not be loaded, with a retry action', () => {
    const onRetry = vi.fn();
    render(<IndicatorOverviewError onRetry={onRetry} />);

    expect(screen.getByText('Não foi possível carregar os indicadores')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
