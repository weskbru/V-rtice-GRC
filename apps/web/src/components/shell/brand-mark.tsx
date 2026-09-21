/**
 * PharosGRC — the lighthouse mark, theme-aware (CLAUDE.md §18.6).
 *
 * ## The defect this exists to fix
 *
 * `public/brand/pharos-mark.svg` is fixed two-tone: `#17324D` navy and
 * `#2878C8` blue. Navy on the dark theme's near-black surface is close to
 * invisible, and both the sidebar and the sign-in card worked around that
 * the same way — by sitting the mark on a hardcoded `bg-white` tile. In the
 * light theme nobody notices. In the dark theme it renders as a bright white
 * block in the top-left corner, brighter than anything else on screen, and
 * the brand reads as pasted onto the application rather than part of it.
 *
 * ## Why an inverse ASSET and not a CSS filter
 *
 * `invert()`/`brightness()` would turn navy into a pale orange and the blue
 * into a muddy tan — it does not invert a two-tone brand into its own
 * inverse treatment, it invents a third colour scheme. `docs/brand/
 * pharos-brand.jpg` already defines the inverse as solid white on navy, and
 * `public/brand/pharos-logo-inverse.svg` already carries exactly those white
 * mark paths inside the full lockup. `pharos-mark-inverse.svg` is that same
 * path data, mark only, in the same `0 0 100 100` box as the positive mark —
 * a faithful extraction of an approved treatment, not a new one.
 *
 * ## Why two `<img>` elements rather than reading the theme in JS
 *
 * `next-themes` resolves the theme on the CLIENT, so a component that
 * branches on `useTheme()` renders the wrong mark for one paint on every
 * load and flickers. Tailwind's `dark:` variant keys off the same `.dark`
 * class `ThemeProvider` puts on `<html>`, so CSS picks the right asset
 * before the first paint, with no hydration gap and no flash. Both images
 * are decorative (`alt=""`, `aria-hidden`) because the visible wordmark next
 * to them already announces the brand — the hidden one adds nothing for a
 * screen reader either way.
 *
 * The tile keeps its light-theme treatment (white, hairline ring) and drops
 * to fully transparent in dark: on that ground the white mark needs no
 * surface of its own, and the ring would only redraw the box this component
 * exists to remove.
 */
import { cn } from '@/lib/utils';

export interface BrandMarkProps {
  /** Tailwind size class for the outer tile (e.g. `size-8`). */
  tileClassName: string;
  /** Tailwind size class for the mark itself (e.g. `size-5`). */
  markClassName: string;
  className?: string;
}

export function BrandMark({
  tileClassName,
  markClassName,
  className,
}: BrandMarkProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md',
        'bg-white shadow-xs ring-1 ring-border/70',
        'dark:bg-transparent dark:shadow-none dark:ring-0',
        tileClassName,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed static brand asset, not an optimizable content image */}
      <img
        src="/brand/pharos-mark.svg"
        alt=""
        aria-hidden="true"
        className={cn('block dark:hidden', markClassName)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed static brand asset, not an optimizable content image */}
      <img
        src="/brand/pharos-mark-inverse.svg"
        alt=""
        aria-hidden="true"
        className={cn('hidden dark:block', markClassName)}
      />
    </span>
  );
}
