// ── Theme Presets — 5 per category (55 total) ───────────────────────────────
// Each preset includes curated colors + font pairing matched to the industry.

export type ThemePreset = {
  name: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontPairingId: string
  colorMode: 'light' | 'dark'
  spacingPreset: 'compact' | 'default' | 'relaxed'
  borderRadius: 'sharp' | 'subtle' | 'rounded' | 'soft' | 'pill'
  shadowPreset: 'none' | 'subtle' | 'medium' | 'dramatic'
}

// ── Restaurant ──────────────────────────────────────────────────────────────
export const RESTAURANT_PRESETS: ThemePreset[] = [
  { name: 'Warm Spice', primaryColor: '#c2410c', secondaryColor: '#ea580c', accentColor: '#f59e0b', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle' },
  { name: 'Night Market', primaryColor: '#dc2626', secondaryColor: '#f97316', accentColor: '#fbbf24', fontPairingId: 'cafe-bistro', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium' },
  { name: 'Garden Dining', primaryColor: '#166534', secondaryColor: '#65a30d', accentColor: '#facc15', fontPairingId: 'artisan', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Hawker Neon', primaryColor: '#e11d48', secondaryColor: '#f43f5e', accentColor: '#06b6d4', fontPairingId: 'bold-impact', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'dramatic' },
  { name: 'Heritage Gold', primaryColor: '#92400e', secondaryColor: '#b45309', accentColor: '#d4a574', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium' },
]

// ── E-commerce ──────────────────────────────────────────────────────────────
export const ECOMMERCE_PRESETS: ThemePreset[] = [
  { name: 'Shopfront Clean', primaryColor: '#2563eb', secondaryColor: '#3b82f6', accentColor: '#f59e0b', fontPairingId: 'modern-clean', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Midnight Mall', primaryColor: '#7c3aed', secondaryColor: '#a78bfa', accentColor: '#f472b6', fontPairingId: 'startup-vibe', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'soft', shadowPreset: 'medium' },
  { name: 'Fresh Market', primaryColor: '#059669', secondaryColor: '#34d399', accentColor: '#f97316', fontPairingId: 'geometric', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Luxury Boutique', primaryColor: '#1e1b4b', secondaryColor: '#4338ca', accentColor: '#c4b5fd', fontPairingId: 'luxury-brand', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'dramatic' },
  { name: 'Warm Bazaar', primaryColor: '#b45309', secondaryColor: '#d97706', accentColor: '#dc2626', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'default', borderRadius: 'soft', shadowPreset: 'subtle' },
]

// ── Beauty ───────────────────────────────────────────────────────────────────
export const BEAUTY_PRESETS: ThemePreset[] = [
  { name: 'Rose Petal', primaryColor: '#db2777', secondaryColor: '#ec4899', accentColor: '#f9a8d4', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle' },
  { name: 'Lavender Dream', primaryColor: '#7c3aed', secondaryColor: '#a78bfa', accentColor: '#f0abfc', fontPairingId: 'luxury-brand', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium' },
  { name: 'Midnight Glam', primaryColor: '#be185d', secondaryColor: '#e11d48', accentColor: '#fda4af', fontPairingId: 'editorial', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'dramatic' },
  { name: 'Soft Blush', primaryColor: '#f472b6', secondaryColor: '#fb923c', accentColor: '#fbbf24', fontPairingId: 'fresh-rounded', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle' },
  { name: 'Natural Glow', primaryColor: '#d97706', secondaryColor: '#b45309', accentColor: '#fef3c7', fontPairingId: 'artisan', colorMode: 'light', spacingPreset: 'default', borderRadius: 'soft', shadowPreset: 'subtle' },
]

// ── Tech ─────────────────────────────────────────────────────────────────────
export const TECH_PRESETS: ThemePreset[] = [
  { name: 'Cyber Blue', primaryColor: '#2563eb', secondaryColor: '#06b6d4', accentColor: '#22d3ee', fontPairingId: 'tech-forward', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium' },
  { name: 'Neon Teal', primaryColor: '#0d9488', secondaryColor: '#14b8a6', accentColor: '#5eead4', fontPairingId: 'futuristic', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'dramatic' },
  { name: 'Clean SaaS', primaryColor: '#4f46e5', secondaryColor: '#818cf8', accentColor: '#f59e0b', fontPairingId: 'startup-vibe', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Minimal Code', primaryColor: '#0ea5e9', secondaryColor: '#38bdf8', accentColor: '#a3e635', fontPairingId: 'minimal-swiss', colorMode: 'light', spacingPreset: 'compact', borderRadius: 'sharp', shadowPreset: 'none' },
  { name: 'Dark Console', primaryColor: '#22c55e', secondaryColor: '#4ade80', accentColor: '#fbbf24', fontPairingId: 'retro-modern', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'medium' },
]

// ── Health ───────────────────────────────────────────────────────────────────
export const HEALTH_PRESETS: ThemePreset[] = [
  { name: 'Clinical Clean', primaryColor: '#0891b2', secondaryColor: '#06b6d4', accentColor: '#14b8a6', fontPairingId: 'pro-corporate', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Healing Green', primaryColor: '#15803d', secondaryColor: '#22c55e', accentColor: '#a3e635', fontPairingId: 'humanist', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle' },
  { name: 'Trust Blue', primaryColor: '#1d4ed8', secondaryColor: '#3b82f6', accentColor: '#93c5fd', fontPairingId: 'modern-clean', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium' },
  { name: 'Warm Wellness', primaryColor: '#0d9488', secondaryColor: '#2dd4bf', accentColor: '#fbbf24', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle' },
  { name: 'Night Care', primaryColor: '#6366f1', secondaryColor: '#818cf8', accentColor: '#c4b5fd', fontPairingId: 'geometric', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium' },
]

// ── Education ────────────────────────────────────────────────────────────────
export const EDUCATION_PRESETS: ThemePreset[] = [
  { name: 'Campus Blue', primaryColor: '#1d4ed8', secondaryColor: '#3b82f6', accentColor: '#fbbf24', fontPairingId: 'geometric', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Bright Classroom', primaryColor: '#f59e0b', secondaryColor: '#f97316', accentColor: '#2563eb', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle' },
  { name: 'Modern Academy', primaryColor: '#4f46e5', secondaryColor: '#7c3aed', accentColor: '#06b6d4', fontPairingId: 'startup-vibe', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium' },
  { name: 'Green Campus', primaryColor: '#15803d', secondaryColor: '#22c55e', accentColor: '#fbbf24', fontPairingId: 'fresh-rounded', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle' },
  { name: 'Study Night', primaryColor: '#6366f1', secondaryColor: '#a78bfa', accentColor: '#f472b6', fontPairingId: 'creative-studio', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium' },
]

// ── Real Estate ──────────────────────────────────────────────────────────────
export const REALESTATE_PRESETS: ThemePreset[] = [
  { name: 'Executive Blue', primaryColor: '#1e3a5f', secondaryColor: '#2563eb', accentColor: '#d4a574', fontPairingId: 'pro-corporate', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'medium' },
  { name: 'Luxury Gold', primaryColor: '#78350f', secondaryColor: '#92400e', accentColor: '#d4a574', fontPairingId: 'luxury-brand', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'dramatic' },
  { name: 'City Modern', primaryColor: '#0f172a', secondaryColor: '#334155', accentColor: '#0ea5e9', fontPairingId: 'minimal-swiss', colorMode: 'light', spacingPreset: 'default', borderRadius: 'sharp', shadowPreset: 'subtle' },
  { name: 'Garden Estate', primaryColor: '#166534', secondaryColor: '#15803d', accentColor: '#fbbf24', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium' },
  { name: 'Penthouse Dark', primaryColor: '#1e1b4b', secondaryColor: '#4338ca', accentColor: '#f59e0b', fontPairingId: 'editorial', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'dramatic' },
]

// ── Fitness ──────────────────────────────────────────────────────────────────
export const FITNESS_PRESETS: ThemePreset[] = [
  { name: 'Power Orange', primaryColor: '#ea580c', secondaryColor: '#f97316', accentColor: '#fbbf24', fontPairingId: 'bold-impact', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'dramatic' },
  { name: 'Iron Red', primaryColor: '#dc2626', secondaryColor: '#ef4444', accentColor: '#fbbf24', fontPairingId: 'bold-geometric', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'sharp', shadowPreset: 'medium' },
  { name: 'Zen Flow', primaryColor: '#0d9488', secondaryColor: '#14b8a6', accentColor: '#d4a574', fontPairingId: 'humanist', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle' },
  { name: 'Neon Gym', primaryColor: '#a3e635', secondaryColor: '#84cc16', accentColor: '#22d3ee', fontPairingId: 'futuristic', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'dramatic' },
  { name: 'Fresh Active', primaryColor: '#2563eb', secondaryColor: '#3b82f6', accentColor: '#f97316', fontPairingId: 'geometric', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
]

// ── Creative ─────────────────────────────────────────────────────────────────
export const CREATIVE_PRESETS: ThemePreset[] = [
  { name: 'Studio Pop', primaryColor: '#f43f5e', secondaryColor: '#ec4899', accentColor: '#fbbf24', fontPairingId: 'creative-studio', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium' },
  { name: 'Dark Portfolio', primaryColor: '#e11d48', secondaryColor: '#f472b6', accentColor: '#22d3ee', fontPairingId: 'retro-modern', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'dramatic' },
  { name: 'Minimal Canvas', primaryColor: '#0f172a', secondaryColor: '#334155', accentColor: '#f59e0b', fontPairingId: 'minimal-swiss', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'sharp', shadowPreset: 'none' },
  { name: 'Vibrant Agency', primaryColor: '#7c3aed', secondaryColor: '#a78bfa', accentColor: '#06b6d4', fontPairingId: 'startup-vibe', colorMode: 'light', spacingPreset: 'default', borderRadius: 'soft', shadowPreset: 'subtle' },
  { name: 'Neon Gallery', primaryColor: '#f97316', secondaryColor: '#fb923c', accentColor: '#a3e635', fontPairingId: 'bold-impact', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'rounded', shadowPreset: 'dramatic' },
]

// ── Business ─────────────────────────────────────────────────────────────────
export const BUSINESS_PRESETS: ThemePreset[] = [
  { name: 'Corporate Trust', primaryColor: '#1e3a5f', secondaryColor: '#2563eb', accentColor: '#f59e0b', fontPairingId: 'pro-corporate', colorMode: 'light', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'subtle' },
  { name: 'Executive Dark', primaryColor: '#0f172a', secondaryColor: '#1e293b', accentColor: '#d4a574', fontPairingId: 'editorial', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'medium' },
  { name: 'Clean Consult', primaryColor: '#4f46e5', secondaryColor: '#6366f1', accentColor: '#06b6d4', fontPairingId: 'modern-clean', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Green Enterprise', primaryColor: '#166534', secondaryColor: '#22c55e', accentColor: '#fbbf24', fontPairingId: 'humanist', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Prestige Gold', primaryColor: '#78350f', secondaryColor: '#92400e', accentColor: '#d4a574', fontPairingId: 'luxury-brand', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'dramatic' },
]

// ── F&B ──────────────────────────────────────────────────────────────────────
export const FNB_PRESETS: ThemePreset[] = [
  { name: 'Kopitiam Classic', primaryColor: '#78350f', secondaryColor: '#92400e', accentColor: '#fbbf24', fontPairingId: 'artisan', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle' },
  { name: 'Bubble Tea Pop', primaryColor: '#d946ef', secondaryColor: '#e879f9', accentColor: '#fbbf24', fontPairingId: 'fresh-rounded', colorMode: 'light', spacingPreset: 'default', borderRadius: 'pill', shadowPreset: 'medium' },
  { name: 'Cafe Noir', primaryColor: '#292524', secondaryColor: '#57534e', accentColor: '#d4a574', fontPairingId: 'cafe-bistro', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'medium' },
  { name: 'Fresh Juice', primaryColor: '#16a34a', secondaryColor: '#65a30d', accentColor: '#f97316', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Night Lounge', primaryColor: '#be185d', secondaryColor: '#db2777', accentColor: '#fbbf24', fontPairingId: 'elegant-serif', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'dramatic' },
]

// ── Events / Wedding ────────────────────────────────────────────────────────
export const EVENTS_PRESETS: ThemePreset[] = [
  { name: 'Elegant Blush', primaryColor: '#be185d', secondaryColor: '#ec4899', accentColor: '#fbbf24', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle' },
  { name: 'Royal Night', primaryColor: '#1e1b4b', secondaryColor: '#4338ca', accentColor: '#d4a574', fontPairingId: 'luxury-brand', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'dramatic' },
  { name: 'Garden Party', primaryColor: '#166534', secondaryColor: '#22c55e', accentColor: '#f9a8d4', fontPairingId: 'artisan', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle' },
  { name: 'Modern Gala', primaryColor: '#0f172a', secondaryColor: '#334155', accentColor: '#f59e0b', fontPairingId: 'minimal-swiss', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'medium' },
  { name: 'Rustic Charm', primaryColor: '#92400e', secondaryColor: '#b45309', accentColor: '#fef3c7', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium' },
]

// ── Blog / Media ────────────────────────────────────────────────────────────
export const BLOG_PRESETS: ThemePreset[] = [
  { name: 'Editorial White', primaryColor: '#0f172a', secondaryColor: '#334155', accentColor: '#dc2626', fontPairingId: 'editorial', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'sharp', shadowPreset: 'none' },
  { name: 'Midnight Read', primaryColor: '#6366f1', secondaryColor: '#818cf8', accentColor: '#f59e0b', fontPairingId: 'retro-modern', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium' },
  { name: 'Fresh Ink', primaryColor: '#059669', secondaryColor: '#34d399', accentColor: '#f97316', fontPairingId: 'fresh-rounded', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Bold Voice', primaryColor: '#dc2626', secondaryColor: '#f43f5e', accentColor: '#fbbf24', fontPairingId: 'bold-impact', colorMode: 'light', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'medium' },
  { name: 'Calm Journal', primaryColor: '#0d9488', secondaryColor: '#14b8a6', accentColor: '#d4a574', fontPairingId: 'humanist', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle' },
]

// ── Travel / Tourism ────────────────────────────────────────────────────────
export const TRAVEL_PRESETS: ThemePreset[] = [
  { name: 'Tropical Escape', primaryColor: '#0891b2', secondaryColor: '#06b6d4', accentColor: '#f59e0b', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Explorer Dark', primaryColor: '#1e3a5f', secondaryColor: '#2563eb', accentColor: '#22d3ee', fontPairingId: 'geometric', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'medium' },
  { name: 'Heritage Trail', primaryColor: '#92400e', secondaryColor: '#b45309', accentColor: '#fbbf24', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium' },
  { name: 'Backpacker Fresh', primaryColor: '#16a34a', secondaryColor: '#65a30d', accentColor: '#f97316', fontPairingId: 'startup-vibe', colorMode: 'light', spacingPreset: 'compact', borderRadius: 'rounded', shadowPreset: 'subtle' },
  { name: 'Island Night', primaryColor: '#7c3aed', secondaryColor: '#a78bfa', accentColor: '#fbbf24', fontPairingId: 'creative-studio', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'dramatic' },
]

// ── Category → Presets Map ──────────────────────────────────────────────────
export const CATEGORY_PRESETS: Record<string, ThemePreset[]> = {
  restaurant: RESTAURANT_PRESETS,
  ecommerce: ECOMMERCE_PRESETS,
  beauty: BEAUTY_PRESETS,
  tech: TECH_PRESETS,
  health: HEALTH_PRESETS,
  education: EDUCATION_PRESETS,
  realestate: REALESTATE_PRESETS,
  fitness: FITNESS_PRESETS,
  creative: CREATIVE_PRESETS,
  business: BUSINESS_PRESETS,
  fnb: FNB_PRESETS,
  events: EVENTS_PRESETS,
  blog: BLOG_PRESETS,
  travel: TRAVEL_PRESETS,
}

export function getCategoryPresets(category: string): ThemePreset[] {
  return CATEGORY_PRESETS[category] ?? []
}
