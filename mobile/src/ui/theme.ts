/** Shared Android MVP visual tokens. Keep semantic roles here, not in screens. */
export const colors = {
  background: '#09090b',
  brand: '#ff4869',
  brandSoft: '#301820',
  border: '#303036',
  accent: '#f4f4f5',
  onAccent: '#111111',
  accentSoft: '#3f3f46',
  danger: '#ef4444',
  dangerForeground: '#ff9c9c',
  foreground: '#fafafa',
  muted: '#b4b4bd',
  placeholder: '#a1a1aa',
  surface: '#17171b',
  surfaceRaised: '#242429',
  coinSurface: '#252117',
  coin: '#f0c76b',
  coinRim: '#b79348',
  coinInk: '#38290d',
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
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fontSizes = {
  caption: 13,
  label: 14,
  body: 16,
  section: 20,
  title: 24,
  display: 32,
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
