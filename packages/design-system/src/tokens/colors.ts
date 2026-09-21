/**
 * PharosGRC Design System — color tokens.
 *
 * Every foreground/background pairing below has been measured against the
 * WCAG 2.1 relative-luminance contrast formula from its actual hex value.
 * Ratios are quoted in each token's comment so a reviewer never has to
 * re-derive them. Targets: 4.5:1 for body-sized text, 3:1 for large text and
 * required UI boundaries (WCAG 1.4.3 / 1.4.11), per SC-012.
 *
 * These are the *raw* color primitives. They are re-expressed as CSS custom
 * properties in `../styles/globals.css` (the Tailwind 4 `@theme` layer) so
 * components consume them via Tailwind utility classes, while this module
 * gives non-CSS consumers (Recharts series colors, canvas/export code, unit
 * tests asserting on real hex values) the same values in TypeScript.
 */

/** Neutral (zinc) ramp — surfaces, borders, body/muted text. */
export const neutral = {
  0: '#ffffff',
  50: '#fafafa',
  100: '#f4f4f5',
  200: '#e4e4e7',
  300: '#d4d4d8',
  400: '#9f9fa9',
  500: '#71717b',
  600: '#52525c',
  700: '#3f3f46',
  800: '#27272a',
  900: '#18181b',
  950: '#09090b',
} as const;

/** Brand (blue) ramp — kept as a generic reference ramp for chart/series
 * diversity. Primary actions, links and focus no longer derive from this —
 * see `brandNavy` below, the PharosGRC institutional palette. */
export const brand = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bedbff',
  300: '#8ec5ff',
  400: '#51a2ff',
  500: '#2b7fff',
  600: '#155dfc',
  700: '#1447e6',
  800: '#193cb8',
  900: '#1c398e',
  950: '#162456',
} as const;

/**
 * PharosGRC institutional brand palette (approved, `docs/brand/pharos-brand.jpg`).
 * `primaryNavy`, `deepNavy`, `slateBlue` and `info` are the same hue family
 * (~210° blue) at different lightness/saturation — see the mark itself,
 * which uses exactly this two-tone navy/blue relationship. This is the
 * *only* source for brand identity color (primary actions, active nav,
 * selection, focus): restrained, not decorative (CLAUDE.md §18.5/§18.8).
 */
export const brandNavy = {
  primaryNavy: '#17324D',
  deepNavy: '#10263A',
  slateBlue: '#40566D',
} as const;

/**
 * A semantic status token: a subtle (tinted) pairing for inline badges and
 * alert surfaces, a solid (strong) pairing for emphasis, and a decorative
 * border. `contrast` documents the *measured* ratio for `subtleFg` on
 * `subtleBg` and for `solidFg` on `solidBg` — both are the pairings actually
 * used for text, computed from the approved hex values via the WCAG
 * relative-luminance formula.
 */
export interface SemanticColorToken {
  subtleBg: string;
  subtleFg: string;
  subtleBorder: string;
  solidBg: string;
  solidFg: string;
  contrast: { subtle: number; solid: number };
}

type SemanticKey = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Generic outcome semantics — success/warning/danger/info/neutral. Used by
 * StatusBadge, toasts and inline alerts (not risk severity — see
 * `riskSeverityLight`/`riskSeverityDark` below for that distinct axis).
 *
 * `solidBg` for each hue is the exact approved palette value
 * (Success #16855B, Warning #C98A00, Error #C83A3A, Info #2878C8). Warning's
 * solid is light enough that white text fails AA (2.95:1) — its `solidFg`
 * is the platform's text-primary color instead (5.52:1), the same pairing
 * `riskSeverityLight.MEDIUM`/`HIGH` reuse for the same reason.
 */
export const statusLight: Record<SemanticKey, SemanticColorToken> = {
  success: {
    subtleBg: '#EFFBF6',
    subtleFg: '#10754F',
    subtleBorder: '#C0EDDC',
    solidBg: '#16855B',
    solidFg: '#ffffff',
    contrast: { subtle: 5.38, solid: 4.63 },
  },
  warning: {
    subtleBg: '#FBF7EF',
    subtleFg: '#7E5907',
    subtleBorder: '#EDDFC0',
    solidBg: '#C98A00',
    solidFg: '#17212B',
    contrast: { subtle: 5.92, solid: 5.52 },
  },
  danger: {
    subtleBg: '#FBEFEF',
    subtleFg: '#6B1A1A',
    subtleBorder: '#EDC0C0',
    solidBg: '#C83A3A',
    solidFg: '#ffffff',
    contrast: { subtle: 10.46, solid: 5.09 },
  },
  info: {
    subtleBg: '#EFF5FB',
    subtleFg: '#134272',
    subtleBorder: '#C0D6ED',
    solidBg: '#2878C8',
    solidFg: '#ffffff',
    contrast: { subtle: 9.33, solid: 4.55 },
  },
  neutral: {
    subtleBg: '#EDEFF2',
    subtleFg: '#29323C',
    subtleBorder: '#D9E0E7',
    solidBg: '#3F4750',
    solidFg: '#ffffff',
    contrast: { subtle: 11.28, solid: 9.42 },
  },
};

/** Same semantic roles, dark-mode pairings. Solid backgrounds are lightened
 * within the same hue so they read against the dark surface (>=3:1 non-text
 * boundary against both `surfaceDark.background` and `.card`); solid
 * foregrounds are a dark shade of the same hue rather than pure black. */
export const statusDark: Record<SemanticKey, SemanticColorToken> = {
  success: {
    subtleBg: '#154734',
    subtleFg: '#B1F1D9',
    subtleBorder: '#257E5D',
    solidBg: '#3DEBA9',
    solidFg: '#084A31',
    contrast: { subtle: 8.3, solid: 6.71 },
  },
  warning: {
    subtleBg: '#473715',
    subtleFg: '#F1DDB1',
    subtleBorder: '#7E6225',
    solidBg: '#F4B834',
    solidFg: '#4E3704',
    contrast: { subtle: 8.61, solid: 6.28 },
  },
  danger: {
    subtleBg: '#471515',
    subtleFg: '#EBB7B7',
    subtleBorder: '#7E2525',
    solidBg: '#E16B6B',
    solidFg: '#440E0E',
    contrast: { subtle: 8.65, solid: 4.96 },
  },
  info: {
    subtleBg: '#152E47',
    subtleFg: '#B2D1F0',
    subtleBorder: '#25527E',
    solidBg: '#4294E6',
    solidFg: '#0A2948',
    contrast: { subtle: 8.77, solid: 4.64 },
  },
  neutral: {
    subtleBg: '#20242A',
    subtleFg: '#E5E8EC',
    subtleBorder: '#3F4750',
    solidBg: '#9AA5B1',
    solidFg: '#1A1E23',
    contrast: { subtle: 12.68, solid: 6.69 },
  },
};

type RiskLevelKey = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Risk severity tokens — one per `RiskLevel` (data-model.md `enum RiskLevel`).
 * Deliberately a *separate* semantic axis from `status*` above (Constitution
 * I: one concept, one name — a risk level is not "an outcome"), even though
 * LOW/MEDIUM/CRITICAL share hues with success/warning/danger by design (the
 * approved palette defines them as the same values — Risk Low = Success,
 * Risk Medium = Warning, Risk Critical = Error). HIGH is the one severity
 * with its own dedicated hue (#D96B27) sitting between Warning and Error.
 * Each level additionally carries a `shape` and `icon` name so severity is
 * never conveyed by hue alone (FR-091, SC-012) — components consuming this
 * token MUST render the icon/shape and a text label, never the color alone.
 */
export interface RiskSeverityToken extends SemanticColorToken {
  /** Lucide icon name the component renders next to the color. */
  icon: 'CircleCheck' | 'TriangleAlert' | 'OctagonAlert';
  /** Non-color shape cue reinforcing the icon (badge border treatment). */
  shape: 'pill' | 'pill-outlined' | 'pill-thick-border' | 'pill-double-border';
}

export const riskSeverityLight: Record<RiskLevelKey, RiskSeverityToken> = {
  LOW: {
    subtleBg: '#EFFBF6',
    subtleFg: '#10754F',
    subtleBorder: '#C0EDDC',
    solidBg: '#16855B',
    solidFg: '#ffffff',
    contrast: { subtle: 5.38, solid: 4.63 },
    icon: 'CircleCheck',
    shape: 'pill',
  },
  MEDIUM: {
    subtleBg: '#FBF7EF',
    subtleFg: '#7E5907',
    subtleBorder: '#EDDFC0',
    solidBg: '#C98A00',
    solidFg: '#17212B',
    contrast: { subtle: 5.92, solid: 5.52 },
    icon: 'TriangleAlert',
    shape: 'pill-outlined',
  },
  HIGH: {
    subtleBg: '#FBF3EF',
    subtleFg: '#743711',
    subtleBorder: '#EDD1C0',
    solidBg: '#D96B27',
    solidFg: '#17212B',
    contrast: { subtle: 8.34, solid: 4.72 },
    icon: 'TriangleAlert',
    shape: 'pill-thick-border',
  },
  CRITICAL: {
    subtleBg: '#FBEFEF',
    subtleFg: '#6B1A1A',
    subtleBorder: '#EDC0C0',
    solidBg: '#C83A3A',
    solidFg: '#ffffff',
    contrast: { subtle: 10.46, solid: 5.09 },
    icon: 'OctagonAlert',
    shape: 'pill-double-border',
  },
};

export const riskSeverityDark: Record<RiskLevelKey, RiskSeverityToken> = {
  LOW: {
    subtleBg: '#154734',
    subtleFg: '#B1F1D9',
    subtleBorder: '#257E5D',
    solidBg: '#3DEBA9',
    solidFg: '#084A31',
    contrast: { subtle: 8.3, solid: 6.71 },
    icon: 'CircleCheck',
    shape: 'pill',
  },
  MEDIUM: {
    subtleBg: '#473715',
    subtleFg: '#F1DDB1',
    subtleBorder: '#7E6225',
    solidBg: '#F4B834',
    solidFg: '#4E3704',
    contrast: { subtle: 8.61, solid: 6.28 },
    icon: 'TriangleAlert',
    shape: 'pill-outlined',
  },
  HIGH: {
    subtleBg: '#472815',
    subtleFg: '#F1C9B1',
    subtleBorder: '#7E4725',
    solidBg: '#EA803E',
    solidFg: '#492108',
    contrast: { subtle: 8.68, solid: 5.09 },
    icon: 'TriangleAlert',
    shape: 'pill-thick-border',
  },
  CRITICAL: {
    subtleBg: '#471515',
    subtleFg: '#EBB7B7',
    subtleBorder: '#7E2525',
    solidBg: '#E16B6B',
    solidFg: '#440E0E',
    contrast: { subtle: 8.65, solid: 4.96 },
    icon: 'OctagonAlert',
    shape: 'pill-double-border',
  },
};

/**
 * Base surface tokens (light mode) — background/foreground/border/ring roles
 * shared by every component. `background` (page canvas) and `card` (default
 * surface) are the approved palette's two distinct light values — the
 * product no longer renders both as plain white, giving cards a visible lift
 * off the canvas (CLAUDE.md §18, surface hierarchy) without shadows.
 *
 * `primary` (fill role: buttons, active nav background, selection) and
 * `primaryOnSurface` (text/icon/ring role: links, focus rings, accents drawn
 * *on top of* a surface) are two different tokens on purpose — see F-30
 * (`docs/deferred-findings.md`): a color chosen to sit on white as a filled
 * background does not automatically work as text on an arbitrary surface,
 * and the reverse is also true (`surfaceDark` below is where the two
 * actually diverge).
 */
export const surfaceLight = {
  background: '#F5F7FA', // page canvas
  foreground: '#17212B', // 15.18:1 on background, 16.29:1 on card
  muted: '#E6EAF0', // sunken/recessed surface (table stripe, input well)
  mutedForeground: '#5B6875', // 5.31:1 on background, 5.7:1 on card
  border: '#D9E0E7', // decorative divider only — never the sole means of identifying a component boundary
  input: brandNavy.slateBlue, // interactive control boundary — 7.06:1 vs background (exceeds the 3:1 UI-boundary target)
  ring: brandNavy.primaryNavy, // focus ring — 12.23:1 vs background
  card: '#FFFFFF', // default surface
  cardForeground: '#17212B',
  popover: '#FFFFFF',
  popoverForeground: '#17212B',
  surfaceRaised: '#FFFFFF', // elevated layer (dialog/dropdown) — differentiated by border, not fill
  surfaceRaisedForeground: '#17212B',
  primary: brandNavy.primaryNavy, // fill role — 13.13:1 with white foreground
  primaryForeground: '#ffffff',
  primaryOnSurface: brandNavy.primaryNavy, // text/icon/ring role — 12.23:1 on background, 13.13:1 on card
  secondary: '#E6EAF0',
  secondaryForeground: '#17212B',
  accent: '#ECEFF1', // brand-tinted hover wash (8% primaryNavy over white)
  accentForeground: '#17212B',
  destructive: '#C83A3A',
  destructiveForeground: '#ffffff', // 5.09:1
} as const;

/**
 * Base surface tokens (dark mode). `primary` here is a brighter tint of the
 * same brand hue (not `primaryNavy` unchanged) — Primary Navy measures only
 * ~1.13-1.35:1 against these dark backgrounds, i.e. a navy button would be
 * nearly invisible against a dark surface, not merely low-contrast text.
 * `primaryOnSurface`/`ring` are lighter again, matching F-30's fix: the role
 * used as text/icon/ring on an arbitrary dark surface needs more lift than
 * the role used as a button's own filled background.
 */
export const surfaceDark = {
  background: neutral[900], // 16.11:1 on foreground below (unchanged from baseline)
  foreground: neutral[100],
  muted: neutral[800],
  mutedForeground: neutral[400], // 6.74:1 on background
  border: neutral[800],
  input: neutral[500], // 3.67:1 vs background — meets the 3:1 UI-boundary target
  ring: '#6CA6E0', // 6.89:1 vs background, 5.79:1 vs card — see primaryOnSurface below
  card: neutral[900],
  cardForeground: neutral[100],
  popover: neutral[900],
  popoverForeground: neutral[100],
  surfaceRaised: neutral[800],
  surfaceRaisedForeground: neutral[100],
  primary: '#2878C8', // fill role — 4.55:1 with white foreground; 3.89:1 vs background, 3.27:1 vs card (pop)
  primaryForeground: '#ffffff',
  primaryOnSurface: '#6CA6E0', // text/icon/ring role (F-30 fix) — 6.89:1 vs background, 5.79:1 vs card
  secondary: neutral[800],
  secondaryForeground: neutral[100],
  accent: neutral[800],
  accentForeground: neutral[100],
  destructive: '#E16B6B',
  destructiveForeground: '#440E0E', // 4.96:1
} as const;
