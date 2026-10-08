import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandMark } from './brand-mark';

describe('BrandMark', () => {
  it('uses the supplied blue symbol in both themes without an inverse recoloring', () => {
    const { container } = render(<BrandMark tileClassName="size-8" markClassName="size-5" />);

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', '/brand/pharos/symbol-96.png');
    expect(images[0]).not.toHaveClass('dark:hidden', 'hidden');
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

    for (const image of container.querySelectorAll('img')) {
      expect(image.getAttribute('alt')).toBe('');
      expect(image.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
