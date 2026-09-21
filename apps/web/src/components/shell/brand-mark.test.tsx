import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BrandMark } from './brand-mark';

/**
 * The dark-theme defect this component fixed was invisible to every test the
 * project had: the mark rendered, the page compiled, and the only symptom was
 * a white block in the corner of a dark screen. These assertions cover the
 * part that IS mechanically checkable — that both assets are present and
 * that each is gated to one theme — so a future edit cannot quietly drop the
 * inverse asset and restore the defect.
 */
describe('BrandMark', () => {
  it('ships both the positive and the inverse asset, one per theme', () => {
    const { container } = render(<BrandMark tileClassName="size-8" markClassName="size-5" />);

    const positive = container.querySelector('img[src="/brand/pharos-mark.svg"]');
    const inverse = container.querySelector('img[src="/brand/pharos-mark-inverse.svg"]');

    expect(positive).not.toBeNull();
    expect(inverse).not.toBeNull();

    // CSS, not JavaScript, decides which one paints — `next-themes` resolves
    // the theme on the client, so a component that branched on `useTheme()`
    // would render the wrong mark for one paint on every load.
    expect(positive?.className).toContain('dark:hidden');
    expect(inverse?.className).toContain('dark:block');
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
