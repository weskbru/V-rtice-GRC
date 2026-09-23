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

export const brandNavy = {
  primaryNavy: '#17324D',
  deepNavy: '#10263A',
  slateBlue: '#40566D',
} as const;

export interface SemanticColorToken {
  subtleBg: string;
  subtleFg: string;
  subtleBorder: string;
  solidBg: string;
  solidFg: string;
  contrast: { subtle: number; solid: number };
}

type SemanticKey = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

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

export interface RiskSeverityToken extends SemanticColorToken {
  icon: 'CircleCheck' | 'TriangleAlert' | 'OctagonAlert';
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

export const surfaceLight = {
  background: '#F5F7FA',
  foreground: '#17212B',
  muted: '#E6EAF0',
  mutedForeground: '#5B6875',
  border: '#D9E0E7',
  input: brandNavy.slateBlue,
  ring: brandNavy.primaryNavy,
  card: '#FFFFFF',
  cardForeground: '#17212B',
  popover: '#FFFFFF',
  popoverForeground: '#17212B',
  surfaceRaised: '#FFFFFF',
  surfaceRaisedForeground: '#17212B',
  primary: brandNavy.primaryNavy,
  primaryForeground: '#ffffff',
  primaryOnSurface: brandNavy.primaryNavy,
  secondary: '#E6EAF0',
  secondaryForeground: '#17212B',
  accent: '#ECEFF1',
  accentForeground: '#17212B',
  destructive: '#C83A3A',
  destructiveForeground: '#ffffff',
} as const;

export const surfaceDark = {
  background: neutral[900],
  foreground: neutral[100],
  muted: neutral[800],
  mutedForeground: neutral[400],
  border: neutral[800],
  input: neutral[500],
  ring: '#6CA6E0',
  card: neutral[900],
  cardForeground: neutral[100],
  popover: neutral[900],
  popoverForeground: neutral[100],
  surfaceRaised: neutral[800],
  surfaceRaisedForeground: neutral[100],
  primary: '#2878C8',
  primaryForeground: '#ffffff',
  primaryOnSurface: '#6CA6E0',
  secondary: neutral[800],
  secondaryForeground: neutral[100],
  accent: neutral[800],
  accentForeground: neutral[100],
  destructive: '#E16B6B',
  destructiveForeground: '#440E0E',
} as const;
