/** Shared Android MVP visual tokens. Keep semantic roles here, not in screens. */
export const colors = {
  background: '#101010',
  border: '#363636',
  accent: '#f5f5f5',
  onAccent: '#111111',
  accentSoft: '#454545',
  danger: '#ef4444',
  dangerForeground: '#ff9c9c',
  foreground: '#fafafa',
  muted: '#b3b3b3',
  placeholder: '#a3a3a3',
  surface: '#1c1c1c',
  surfaceRaised: '#292929',
  coin: '#e0b653',
  coinRim: '#a87c25',
  coinInk: '#38290d',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 8,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radii = {
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export const fontSizes = {
  caption: 13,
  label: 14,
  body: 16,
  section: 18,
  title: 22,
  display: 34,
  artworkFallback: 28,
} as const;

/** Android accessibility guidance recommends at least a 48dp interactive target. */
export const minimumTouchTarget = 48;

/** Original abstract poster palettes, used only when catalog artwork is missing. */
export const artworkPalettes = [
  { background: '#172936', glow: '#b7cfdf', beam: '#416276', foreground: '#101b24' },
  { background: '#20343c', glow: '#dfba8c', beam: '#527c80', foreground: '#152631' },
  { background: '#302b21', glow: '#d7c49b', beam: '#746447', foreground: '#1a1915' },
] as const;
