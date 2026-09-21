/**
 * PharosGRC Design System — spacing tokens.
 *
 * Tailwind's default 4px spacing multiplier (`--spacing: 0.25rem`) already
 * supplies the numeric scale (`p-4`, `gap-2`, ...) and is left untouched.
 * This module adds *named* semantic steps for layout-level spacing (page
 * gutters, section gaps, card padding) so every screen composes the same
 * rhythm instead of each feature picking its own numeric utility — generous
 * but not wasteful, per the design direction.
 */

export const space = {
  none: '0px',
  xs: '0.25rem', // 4px  — tight inline gaps (icon-to-label)
  sm: '0.5rem', // 8px  — compact control padding
  md: '0.75rem', // 12px — default control padding, table cell padding
  lg: '1rem', // 16px — card padding, form field gaps
  xl: '1.5rem', // 24px — section gaps within a page
  '2xl': '2rem', // 32px — page gutters (desktop content padding)
  '3xl': '3rem', // 48px — between major page sections
  '4xl': '4rem', // 64px — page-level top/bottom whitespace
} as const;

export type SpaceToken = keyof typeof space;

/**
 * Page-level layout conventions — content width and horizontal gutter. No
 * screen currently reads these (each route pads/widths itself ad hoc today,
 * e.g. login's own `max-w-sm`); they exist so the next wave that touches a
 * screen's layout has one place to match rather than inventing its own
 * number. Not wired into `app-shell.tsx` this wave (CLAUDE.md §18 — this
 * pass builds the token layer, not the shell).
 */
export const layout = {
  /** Max width of a page's main content column — dense tables/forms get
   * real room; wider than this and line length/scanning suffers. */
  contentMaxWidth: '80rem', // 1280px
  /** Horizontal page gutter, small viewport. */
  pagePaddingXSm: space.lg, // 16px
  /** Horizontal page gutter, desktop viewport (matches `space['2xl']`). */
  pagePaddingXLg: space['2xl'], // 32px
} as const;
