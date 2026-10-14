export const interactionState = {
  hoverOverlay: 'rgb(23 50 77 / 0.05)',
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
  easingEmphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;
