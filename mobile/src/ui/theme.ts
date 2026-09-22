/** Shared Android MVP visual tokens. Keep semantic roles here, not in screens.

 * Palette matches the web reference client (commit e6e0d5f) and Tailwind
 * amber / neutral / rose / violet stops used there.
 */
export const colors = {
  /** body background #0a0a0c from web index.css */
  background: '#0a0a0c',
  /** amber-500 */
  brand: '#f59e0b',
  brandSoft: '#2a2114',
  /** neutral-800 */
  border: '#27272a',
  /** amber-500 — primary CTA fill */
  accent: '#f59e0b',
  onAccent: '#0a0a0c',
  accentSoft: '#3a2a12',
  /** rose-500 / rose-300 for danger copy */
  danger: '#f43f5e',
  dangerForeground: '#fda4af',
  /** zinc-100 body text from web index.css */
  foreground: '#f4f4f5',
  /** neutral-400 */
  muted: '#a3a3a3',
  /** neutral-500 */
  placeholder: '#737373',
  /** neutral-900 */
  surface: '#171717',
  /** neutral-800 */
  surfaceRaised: '#262626',
  coinSurface: '#1c170f',
  /** amber-400 */
  coin: '#fbbf24',
  /** amber-600 */
  coinRim: '#d97706',
  coinInk: '#0a0a0c',
  /** violet-600 — logo tile end stop */
  brandViolet: '#7c3aed',
  /** rose-500 — logo tile mid stop */
  brandRose: '#f43f5e',
  /** amber-200 — wordmark end stop */
  brandHighlight: '#fde68a',
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
  lg: 16,
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
