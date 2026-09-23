export const space = {
  none: '0px',
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
  '3xl': '3rem',
  '4xl': '4rem',
} as const;

export type SpaceToken = keyof typeof space;

export const layout = {
  contentMaxWidth: '80rem',
  pagePaddingXSm: space.lg,
  pagePaddingXLg: space['2xl'],
} as const;
