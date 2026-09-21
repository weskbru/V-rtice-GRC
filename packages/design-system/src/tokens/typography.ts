/**
 * PharosGRC Design System — typography tokens.
 *
 * An enterprise GRC platform reads dense tabular and form content for long
 * sessions; the scale favors a restrained number of steps with a clear
 * hierarchy over a large decorative range. Mirrored as `--text-*` /
 * `--font-weight-*` keys in the Tailwind 4 `@theme` layer.
 */

export const fontFamily = {
  sans: [
    'Inter',
    'ui-sans-serif',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ].join(', '),
  mono: [
    'ui-monospace',
    'SFMono-Regular',
    'Menlo',
    'Consolas',
    'Liberation Mono',
    'monospace',
  ].join(', '),
} as const;

export interface TypeStep {
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
}

/**
 * Named scale, small to large. `body` is the default reading size (16px) —
 * every pairing that renders it against `surfaceLight.background` /
 * `surfaceDark.background` meets 4.5:1 (see colors.ts `foreground`).
 */
export const typeScale: Record<
  'caption' | 'bodySm' | 'body' | 'bodyLg' | 'h4' | 'h3' | 'h2' | 'h1' | 'display',
  TypeStep
> = {
  caption: { fontSize: '0.75rem', lineHeight: '1rem', fontWeight: 500, letterSpacing: '0.01em' },
  bodySm: { fontSize: '0.8125rem', lineHeight: '1.25rem', fontWeight: 400 },
  body: { fontSize: '0.875rem', lineHeight: '1.4286', fontWeight: 400 },
  bodyLg: { fontSize: '1rem', lineHeight: '1.5', fontWeight: 400 },
  h4: { fontSize: '1.125rem', lineHeight: '1.4', fontWeight: 600 },
  h3: { fontSize: '1.375rem', lineHeight: '1.3', fontWeight: 600, letterSpacing: '-0.01em' },
  h2: { fontSize: '1.75rem', lineHeight: '1.25', fontWeight: 600, letterSpacing: '-0.015em' },
  h1: { fontSize: '2.25rem', lineHeight: '1.2', fontWeight: 700, letterSpacing: '-0.02em' },
  display: { fontSize: '2.75rem', lineHeight: '1.1', fontWeight: 700, letterSpacing: '-0.02em' },
};

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;
