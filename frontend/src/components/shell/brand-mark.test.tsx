import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandMark } from './brand-mark';

describe('BrandMark', () => {
  it('uses the vector symbol with theme-aware colors', () => {
    const { container } = render(<BrandMark tileClassName="size-8" markClassName="size-5" />);

    const symbols = container.querySelectorAll('svg');
    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toHaveAttribute('viewBox', '0 0 100 100');
    expect(symbols[0]?.querySelectorAll('path')).toHaveLength(2);
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('drops the white tile in the dark theme rather than keeping a lighter one', () => {
    const { container } = render(<BrandMark tileClassName="size-8" markClassName="size-5" />);

    const tile = container.firstElementChild;
    expect(tile?.className).toContain('bg-white');
    expect(tile?.className).toContain('dark:bg-transparent');
    expect(tile?.className).toContain('dark:ring-0');
  });

  it('stays decorative — the visible wordmark beside it already names the brand', () => {
    const { container } = render(<BrandMark tileClassName="size-8" markClassName="size-5" />);

    for (const symbol of container.querySelectorAll('svg')) {
      expect(symbol.getAttribute('aria-hidden')).toBe('true');
      expect(symbol.getAttribute('focusable')).toBe('false');
    }
  });
});
