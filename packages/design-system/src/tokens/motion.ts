/**
 * PharosGRC Design System — interaction-state and motion tokens.
 *
 * Hover/active/focus/disabled are expressed as overlay opacities applied on
 * top of a component's base color (so they compose with any semantic/severity
 * token) plus a focus-ring spec and shared transition timing. Kept subtle —
 * enterprise density, not decorative motion.
 */

export const interactionState = {
  // Brand-tinted (Primary Navy #17324D at low alpha) rather than plain black,
  // so hover/active states carry a trace of institutional identity instead
  // of a generic gray wash (CLAUDE.md §18.5 — restrained, not decorative).
  hoverOverlay: 'rgb(23 50 77 / 0.05)', // light-mode hover wash; dark mode uses hoverOverlayInverse
  hoverOverlayInverse: 'rgb(255 255 255 / 0.06)',
  activeOverlay: 'rgb(23 50 77 / 0.09)',
  activeOverlayInverse: 'rgb(255 255 255 / 0.1)',
  disabledOpacity: 0.5,
  focusRingWidth: '2px',
  focusRingOffset: '2px',
} as const;

export const motion = {
  durationFast: '120ms',
  durationBase: '180ms',
  durationSlow: '260ms',
  easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  // Exponential/quart-style ease-out (decelerate hard, never overshoot).
  // Previously cubic-bezier(0.2, 0, 0, 1.4) — a >1 output value is bounce
  // easing (the curve overshoots past its target before settling), which
  // reads as dated and toy-like in an institutional product (Impeccable
  // finding, tokens/motion.ts line 25). This curve still finishes snappier
  // than `easingStandard` for emphasis (dialogs, menu open) without any
  // overshoot.
  easingEmphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;
