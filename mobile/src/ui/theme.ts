/** Shared Android MVP visual tokens. Keep semantic roles here, not in screens. */
export const colors = {
  background: '#09090b',
  border: '#3f3f46',
  danger: '#ef4444',
  foreground: '#fafafa',
  muted: '#a1a1aa',
  placeholder: '#71717a',
  surface: '#18181b',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radii = {
  md: 8,
} as const;

export const fontSizes = {
  caption: 13,
  label: 14,
  body: 16,
  section: 18,
  title: 22,
  artworkFallback: 28,
} as const;

/** Android accessibility guidance recommends at least a 48dp interactive target. */
export const minimumTouchTarget = 48;
