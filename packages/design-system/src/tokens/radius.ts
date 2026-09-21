/**
 * PharosGRC Design System — corner radius tokens.
 *
 * A single base (`--radius`) drives the derived steps, matching shadcn/ui's
 * convention so generated primitives (T044) inherit this scale automatically
 * through the `@theme inline` mapping in globals.css. Kept modest (8px base)
 * for a serious, professional register/form aesthetic rather than a rounded
 * consumer look.
 */

export const radiusBase = '0.5rem'; // 8px

export const radius = {
  none: '0px',
  sm: 'calc(0.5rem - 4px)', // 4px
  md: 'calc(0.5rem - 2px)', // 6px
  lg: '0.5rem', // 8px
  xl: 'calc(0.5rem + 4px)', // 12px
  full: '9999px',
} as const;
