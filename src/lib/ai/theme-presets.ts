// ── Theme Presets — 8 per category (112 total) ──────────────────────────────
// Each preset includes curated colors + font pairing matched to the industry.
// Plan 2253 Phase 02 (variety): expanded from 5→8 per category with new
// fontPairingIds (magazine-cover, boutique-serif, warm-editorial,
// contemporary, classical, hospitality) to increase (primary, font) combo
// diversity per category.
// Plan 260414-2249 phase-02 (moods): every preset also carries a `moodId`
// mapping to 6 ThemeMood archetypes in `theme-moods.ts` — drives GPT voice,
// Unsplash imagery keywords, and composer CTAs.

import type { MoodId } from './theme-moods'

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
  /** Plan 260414-2249 phase-02: mood archetype — drives voice, imagery, CTAs. */
  moodId: MoodId
}

// ── Restaurant ──────────────────────────────────────────────────────────────
export const RESTAURANT_PRESETS: ThemePreset[] = [
  { name: 'Warm Spice', primaryColor: '#c2410c', secondaryColor: '#ea580c', accentColor: '#f59e0b', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'elegant' },
  { name: 'Night Market', primaryColor: '#dc2626', secondaryColor: '#f97316', accentColor: '#fbbf24', fontPairingId: 'cafe-bistro', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'bold' },
  { name: 'Garden Dining', primaryColor: '#166534', secondaryColor: '#65a30d', accentColor: '#facc15', fontPairingId: 'artisan', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Hawker Neon', primaryColor: '#e11d48', secondaryColor: '#f43f5e', accentColor: '#06b6d4', fontPairingId: 'bold-impact', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'dramatic', moodId: 'bold' },
  { name: 'Heritage Gold', primaryColor: '#92400e', secondaryColor: '#b45309', accentColor: '#d4a574', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'elegant' },
  // Plan 2253 Phase 02 — 3 new presets for variety (R3 fix — 5→8 per category)
  { name: 'Coastal Catch', primaryColor: '#0e7490', secondaryColor: '#0891b2', accentColor: '#fbbf24', fontPairingId: 'magazine-cover', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'editorial' },
  { name: 'Smoke & Char', primaryColor: '#3f3f46', secondaryColor: '#71717a', accentColor: '#f97316', fontPairingId: 'contemporary', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'sharp', shadowPreset: 'medium', moodId: 'bold' },
  { name: 'Sunset Rustic', primaryColor: '#b91c1c', secondaryColor: '#d97706', accentColor: '#fef3c7', fontPairingId: 'warm-editorial', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'playful' },
]

// ── E-commerce ──────────────────────────────────────────────────────────────
export const ECOMMERCE_PRESETS: ThemePreset[] = [
  { name: 'Shopfront Clean', primaryColor: '#2563eb', secondaryColor: '#3b82f6', accentColor: '#f59e0b', fontPairingId: 'modern-clean', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'tech-minimal' },
  { name: 'Midnight Mall', primaryColor: '#7c3aed', secondaryColor: '#a78bfa', accentColor: '#f472b6', fontPairingId: 'startup-vibe', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'bold' },
  { name: 'Fresh Market', primaryColor: '#059669', secondaryColor: '#34d399', accentColor: '#f97316', fontPairingId: 'geometric', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Luxury Boutique', primaryColor: '#1e1b4b', secondaryColor: '#4338ca', accentColor: '#c4b5fd', fontPairingId: 'luxury-brand', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'dramatic', moodId: 'elegant' },
  { name: 'Warm Bazaar', primaryColor: '#b45309', secondaryColor: '#d97706', accentColor: '#dc2626', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'default', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'playful' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Pastel Shelf', primaryColor: '#db2777', secondaryColor: '#f472b6', accentColor: '#a3e635', fontPairingId: 'hospitality', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Industrial Cart', primaryColor: '#0f172a', secondaryColor: '#334155', accentColor: '#f59e0b', fontPairingId: 'classical', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'sharp', shadowPreset: 'medium', moodId: 'bold' },
  { name: 'Earth Tones', primaryColor: '#78350f', secondaryColor: '#b45309', accentColor: '#a3e635', fontPairingId: 'magazine-cover', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'serene' },
]

// ── Beauty ───────────────────────────────────────────────────────────────────
export const BEAUTY_PRESETS: ThemePreset[] = [
  { name: 'Rose Petal', primaryColor: '#db2777', secondaryColor: '#ec4899', accentColor: '#f9a8d4', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle', moodId: 'elegant' },
  { name: 'Lavender Dream', primaryColor: '#7c3aed', secondaryColor: '#a78bfa', accentColor: '#f0abfc', fontPairingId: 'luxury-brand', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'elegant' },
  { name: 'Midnight Glam', primaryColor: '#be185d', secondaryColor: '#e11d48', accentColor: '#fda4af', fontPairingId: 'editorial', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'dramatic', moodId: 'editorial' },
  { name: 'Soft Blush', primaryColor: '#f472b6', secondaryColor: '#fb923c', accentColor: '#fbbf24', fontPairingId: 'fresh-rounded', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Natural Glow', primaryColor: '#d97706', secondaryColor: '#b45309', accentColor: '#fef3c7', fontPairingId: 'artisan', colorMode: 'light', spacingPreset: 'default', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'serene' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Champagne Silk', primaryColor: '#a16207', secondaryColor: '#ca8a04', accentColor: '#fde68a', fontPairingId: 'boutique-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'elegant' },
  { name: 'Botanical Spa', primaryColor: '#15803d', secondaryColor: '#65a30d', accentColor: '#fcd34d', fontPairingId: 'contemporary', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Velvet Noir', primaryColor: '#6d28d9', secondaryColor: '#a855f7', accentColor: '#fbcfe8', fontPairingId: 'magazine-cover', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'dramatic', moodId: 'editorial' },
]

// ── Tech ─────────────────────────────────────────────────────────────────────
export const TECH_PRESETS: ThemePreset[] = [
  { name: 'Cyber Blue', primaryColor: '#2563eb', secondaryColor: '#06b6d4', accentColor: '#22d3ee', fontPairingId: 'tech-forward', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'bold' },
  { name: 'Neon Teal', primaryColor: '#0d9488', secondaryColor: '#14b8a6', accentColor: '#5eead4', fontPairingId: 'futuristic', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'dramatic', moodId: 'bold' },
  { name: 'Clean SaaS', primaryColor: '#4f46e5', secondaryColor: '#818cf8', accentColor: '#f59e0b', fontPairingId: 'startup-vibe', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'tech-minimal' },
  { name: 'Minimal Code', primaryColor: '#0ea5e9', secondaryColor: '#38bdf8', accentColor: '#a3e635', fontPairingId: 'minimal-swiss', colorMode: 'light', spacingPreset: 'compact', borderRadius: 'sharp', shadowPreset: 'none', moodId: 'tech-minimal' },
  { name: 'Dark Console', primaryColor: '#22c55e', secondaryColor: '#4ade80', accentColor: '#fbbf24', fontPairingId: 'retro-modern', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'tech-minimal' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Developer Slate', primaryColor: '#1e293b', secondaryColor: '#475569', accentColor: '#06b6d4', fontPairingId: 'contemporary', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'sharp', shadowPreset: 'subtle', moodId: 'tech-minimal' },
  { name: 'AI Violet', primaryColor: '#9333ea', secondaryColor: '#c084fc', accentColor: '#22d3ee', fontPairingId: 'boutique-serif', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'dramatic', moodId: 'bold' },
  { name: 'Daylight Build', primaryColor: '#0369a1', secondaryColor: '#0284c7', accentColor: '#f97316', fontPairingId: 'classical', colorMode: 'light', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'tech-minimal' },
]

// ── Health ───────────────────────────────────────────────────────────────────
export const HEALTH_PRESETS: ThemePreset[] = [
  { name: 'Clinical Clean', primaryColor: '#0891b2', secondaryColor: '#06b6d4', accentColor: '#14b8a6', fontPairingId: 'pro-corporate', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'tech-minimal' },
  { name: 'Healing Green', primaryColor: '#15803d', secondaryColor: '#22c55e', accentColor: '#a3e635', fontPairingId: 'humanist', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Trust Blue', primaryColor: '#1d4ed8', secondaryColor: '#3b82f6', accentColor: '#93c5fd', fontPairingId: 'modern-clean', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'elegant' },
  { name: 'Warm Wellness', primaryColor: '#0d9488', secondaryColor: '#2dd4bf', accentColor: '#fbbf24', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Night Care', primaryColor: '#6366f1', secondaryColor: '#818cf8', accentColor: '#c4b5fd', fontPairingId: 'geometric', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'editorial' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Mint Recovery', primaryColor: '#059669', secondaryColor: '#10b981', accentColor: '#a7f3d0', fontPairingId: 'classical', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Mindful Coral', primaryColor: '#ea580c', secondaryColor: '#fb923c', accentColor: '#fde68a', fontPairingId: 'hospitality', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'serene' },
  { name: 'Clinic Slate', primaryColor: '#334155', secondaryColor: '#64748b', accentColor: '#06b6d4', fontPairingId: 'contemporary', colorMode: 'light', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'subtle', moodId: 'tech-minimal' },
]

// ── Education ────────────────────────────────────────────────────────────────
export const EDUCATION_PRESETS: ThemePreset[] = [
  { name: 'Campus Blue', primaryColor: '#1d4ed8', secondaryColor: '#3b82f6', accentColor: '#fbbf24', fontPairingId: 'geometric', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'elegant' },
  { name: 'Bright Classroom', primaryColor: '#f59e0b', secondaryColor: '#f97316', accentColor: '#2563eb', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Modern Academy', primaryColor: '#4f46e5', secondaryColor: '#7c3aed', accentColor: '#06b6d4', fontPairingId: 'startup-vibe', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'tech-minimal' },
  { name: 'Green Campus', primaryColor: '#15803d', secondaryColor: '#22c55e', accentColor: '#fbbf24', fontPairingId: 'fresh-rounded', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Study Night', primaryColor: '#6366f1', secondaryColor: '#a78bfa', accentColor: '#f472b6', fontPairingId: 'creative-studio', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'editorial' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Library Brown', primaryColor: '#78350f', secondaryColor: '#a16207', accentColor: '#fde68a', fontPairingId: 'boutique-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'editorial' },
  { name: 'STEM Cyan', primaryColor: '#0e7490', secondaryColor: '#22d3ee', accentColor: '#facc15', fontPairingId: 'contemporary', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'tech-minimal' },
  { name: 'Kindergarten Pop', primaryColor: '#ec4899', secondaryColor: '#fb7185', accentColor: '#a3e635', fontPairingId: 'hospitality', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'medium', moodId: 'playful' },
]

// ── Real Estate ──────────────────────────────────────────────────────────────
export const REALESTATE_PRESETS: ThemePreset[] = [
  { name: 'Executive Blue', primaryColor: '#1e3a5f', secondaryColor: '#2563eb', accentColor: '#d4a574', fontPairingId: 'pro-corporate', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'elegant' },
  { name: 'Luxury Gold', primaryColor: '#78350f', secondaryColor: '#92400e', accentColor: '#d4a574', fontPairingId: 'luxury-brand', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'dramatic', moodId: 'elegant' },
  { name: 'City Modern', primaryColor: '#0f172a', secondaryColor: '#334155', accentColor: '#0ea5e9', fontPairingId: 'minimal-swiss', colorMode: 'light', spacingPreset: 'default', borderRadius: 'sharp', shadowPreset: 'subtle', moodId: 'tech-minimal' },
  { name: 'Garden Estate', primaryColor: '#166534', secondaryColor: '#15803d', accentColor: '#fbbf24', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'serene' },
  { name: 'Penthouse Dark', primaryColor: '#1e1b4b', secondaryColor: '#4338ca', accentColor: '#f59e0b', fontPairingId: 'editorial', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'dramatic', moodId: 'editorial' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Mediterranean', primaryColor: '#075985', secondaryColor: '#0369a1', accentColor: '#fcd34d', fontPairingId: 'magazine-cover', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'editorial' },
  { name: 'Desert Sand', primaryColor: '#a16207', secondaryColor: '#d97706', accentColor: '#fed7aa', fontPairingId: 'warm-editorial', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Metropolitan', primaryColor: '#1f2937', secondaryColor: '#374151', accentColor: '#10b981', fontPairingId: 'contemporary', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'tech-minimal' },
]

// ── Fitness ──────────────────────────────────────────────────────────────────
export const FITNESS_PRESETS: ThemePreset[] = [
  { name: 'Power Orange', primaryColor: '#ea580c', secondaryColor: '#f97316', accentColor: '#fbbf24', fontPairingId: 'bold-impact', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'dramatic', moodId: 'bold' },
  { name: 'Iron Red', primaryColor: '#dc2626', secondaryColor: '#ef4444', accentColor: '#fbbf24', fontPairingId: 'bold-geometric', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'sharp', shadowPreset: 'medium', moodId: 'bold' },
  { name: 'Zen Flow', primaryColor: '#0d9488', secondaryColor: '#14b8a6', accentColor: '#d4a574', fontPairingId: 'humanist', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Neon Gym', primaryColor: '#a3e635', secondaryColor: '#84cc16', accentColor: '#22d3ee', fontPairingId: 'futuristic', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'dramatic', moodId: 'bold' },
  { name: 'Fresh Active', primaryColor: '#2563eb', secondaryColor: '#3b82f6', accentColor: '#f97316', fontPairingId: 'geometric', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'tech-minimal' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Crossfit Graphite', primaryColor: '#18181b', secondaryColor: '#52525b', accentColor: '#facc15', fontPairingId: 'contemporary', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'sharp', shadowPreset: 'dramatic', moodId: 'bold' },
  { name: 'Yoga Sunrise', primaryColor: '#d97706', secondaryColor: '#fbbf24', accentColor: '#fda4af', fontPairingId: 'hospitality', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Boxing Crimson', primaryColor: '#991b1b', secondaryColor: '#dc2626', accentColor: '#f4f4f5', fontPairingId: 'boutique-serif', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'bold' },
]

// ── Creative ─────────────────────────────────────────────────────────────────
export const CREATIVE_PRESETS: ThemePreset[] = [
  { name: 'Studio Pop', primaryColor: '#f43f5e', secondaryColor: '#ec4899', accentColor: '#fbbf24', fontPairingId: 'creative-studio', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'playful' },
  { name: 'Dark Portfolio', primaryColor: '#e11d48', secondaryColor: '#f472b6', accentColor: '#22d3ee', fontPairingId: 'retro-modern', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'dramatic', moodId: 'editorial' },
  { name: 'Minimal Canvas', primaryColor: '#0f172a', secondaryColor: '#334155', accentColor: '#f59e0b', fontPairingId: 'minimal-swiss', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'sharp', shadowPreset: 'none', moodId: 'tech-minimal' },
  { name: 'Vibrant Agency', primaryColor: '#7c3aed', secondaryColor: '#a78bfa', accentColor: '#06b6d4', fontPairingId: 'startup-vibe', colorMode: 'light', spacingPreset: 'default', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Neon Gallery', primaryColor: '#f97316', secondaryColor: '#fb923c', accentColor: '#a3e635', fontPairingId: 'bold-impact', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'rounded', shadowPreset: 'dramatic', moodId: 'bold' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Gallery White', primaryColor: '#0f172a', secondaryColor: '#64748b', accentColor: '#d946ef', fontPairingId: 'boutique-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'sharp', shadowPreset: 'subtle', moodId: 'editorial' },
  { name: 'Print Workshop', primaryColor: '#7c2d12', secondaryColor: '#a16207', accentColor: '#fef3c7', fontPairingId: 'warm-editorial', colorMode: 'light', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'editorial' },
  { name: 'Club Poster', primaryColor: '#8b5cf6', secondaryColor: '#d946ef', accentColor: '#facc15', fontPairingId: 'magazine-cover', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'sharp', shadowPreset: 'dramatic', moodId: 'bold' },
]

// ── Business ─────────────────────────────────────────────────────────────────
export const BUSINESS_PRESETS: ThemePreset[] = [
  { name: 'Corporate Trust', primaryColor: '#1e3a5f', secondaryColor: '#2563eb', accentColor: '#f59e0b', fontPairingId: 'pro-corporate', colorMode: 'light', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'subtle', moodId: 'elegant' },
  { name: 'Executive Dark', primaryColor: '#0f172a', secondaryColor: '#1e293b', accentColor: '#d4a574', fontPairingId: 'editorial', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'editorial' },
  { name: 'Clean Consult', primaryColor: '#4f46e5', secondaryColor: '#6366f1', accentColor: '#06b6d4', fontPairingId: 'modern-clean', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'tech-minimal' },
  { name: 'Green Enterprise', primaryColor: '#166534', secondaryColor: '#22c55e', accentColor: '#fbbf24', fontPairingId: 'humanist', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Prestige Gold', primaryColor: '#78350f', secondaryColor: '#92400e', accentColor: '#d4a574', fontPairingId: 'luxury-brand', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'subtle', shadowPreset: 'dramatic', moodId: 'elegant' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Law Office', primaryColor: '#451a03', secondaryColor: '#78350f', accentColor: '#fef3c7', fontPairingId: 'classical', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'sharp', shadowPreset: 'subtle', moodId: 'elegant' },
  { name: 'Accounting Sage', primaryColor: '#065f46', secondaryColor: '#047857', accentColor: '#fde047', fontPairingId: 'contemporary', colorMode: 'light', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'serene' },
  { name: 'Agency Midnight', primaryColor: '#1e1b4b', secondaryColor: '#3730a3', accentColor: '#fb923c', fontPairingId: 'magazine-cover', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'dramatic', moodId: 'editorial' },
]

// ── F&B ──────────────────────────────────────────────────────────────────────
export const FNB_PRESETS: ThemePreset[] = [
  { name: 'Kopitiam Classic', primaryColor: '#78350f', secondaryColor: '#92400e', accentColor: '#fbbf24', fontPairingId: 'artisan', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'elegant' },
  { name: 'Bubble Tea Pop', primaryColor: '#d946ef', secondaryColor: '#e879f9', accentColor: '#fbbf24', fontPairingId: 'fresh-rounded', colorMode: 'light', spacingPreset: 'default', borderRadius: 'pill', shadowPreset: 'medium', moodId: 'playful' },
  { name: 'Cafe Noir', primaryColor: '#292524', secondaryColor: '#57534e', accentColor: '#d4a574', fontPairingId: 'cafe-bistro', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'editorial' },
  { name: 'Fresh Juice', primaryColor: '#16a34a', secondaryColor: '#65a30d', accentColor: '#f97316', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Night Lounge', primaryColor: '#be185d', secondaryColor: '#db2777', accentColor: '#fbbf24', fontPairingId: 'elegant-serif', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'dramatic', moodId: 'elegant' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Matcha House', primaryColor: '#166534', secondaryColor: '#84cc16', accentColor: '#fde68a', fontPairingId: 'hospitality', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Specialty Roast', primaryColor: '#451a03', secondaryColor: '#7c2d12', accentColor: '#fde68a', fontPairingId: 'boutique-serif', colorMode: 'light', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'editorial' },
  { name: 'Dessert Bar', primaryColor: '#ec4899', secondaryColor: '#f472b6', accentColor: '#fef3c7', fontPairingId: 'magazine-cover', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'medium', moodId: 'playful' },
]

// ── Events / Wedding ────────────────────────────────────────────────────────
export const EVENTS_PRESETS: ThemePreset[] = [
  { name: 'Elegant Blush', primaryColor: '#be185d', secondaryColor: '#ec4899', accentColor: '#fbbf24', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'elegant' },
  { name: 'Royal Night', primaryColor: '#1e1b4b', secondaryColor: '#4338ca', accentColor: '#d4a574', fontPairingId: 'luxury-brand', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'dramatic', moodId: 'elegant' },
  { name: 'Garden Party', primaryColor: '#166534', secondaryColor: '#22c55e', accentColor: '#f9a8d4', fontPairingId: 'artisan', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Modern Gala', primaryColor: '#0f172a', secondaryColor: '#334155', accentColor: '#f59e0b', fontPairingId: 'minimal-swiss', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'tech-minimal' },
  { name: 'Rustic Charm', primaryColor: '#92400e', secondaryColor: '#b45309', accentColor: '#fef3c7', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'serene' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Champagne Toast', primaryColor: '#a16207', secondaryColor: '#eab308', accentColor: '#fff7ed', fontPairingId: 'boutique-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'elegant' },
  { name: 'Beach Ceremony', primaryColor: '#0891b2', secondaryColor: '#06b6d4', accentColor: '#fed7aa', fontPairingId: 'hospitality', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'pill', shadowPreset: 'subtle', moodId: 'serene' },
  { name: 'Winter Wonder', primaryColor: '#1e40af', secondaryColor: '#3b82f6', accentColor: '#e0e7ff', fontPairingId: 'magazine-cover', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'dramatic', moodId: 'editorial' },
]

// ── Blog / Media ────────────────────────────────────────────────────────────
export const BLOG_PRESETS: ThemePreset[] = [
  { name: 'Editorial White', primaryColor: '#0f172a', secondaryColor: '#334155', accentColor: '#dc2626', fontPairingId: 'editorial', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'sharp', shadowPreset: 'none', moodId: 'editorial' },
  { name: 'Midnight Read', primaryColor: '#6366f1', secondaryColor: '#818cf8', accentColor: '#f59e0b', fontPairingId: 'retro-modern', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'medium', moodId: 'editorial' },
  { name: 'Fresh Ink', primaryColor: '#059669', secondaryColor: '#34d399', accentColor: '#f97316', fontPairingId: 'fresh-rounded', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Bold Voice', primaryColor: '#dc2626', secondaryColor: '#f43f5e', accentColor: '#fbbf24', fontPairingId: 'bold-impact', colorMode: 'light', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'bold' },
  { name: 'Calm Journal', primaryColor: '#0d9488', secondaryColor: '#14b8a6', accentColor: '#d4a574', fontPairingId: 'humanist', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'serene' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Typewriter', primaryColor: '#44403c', secondaryColor: '#78716c', accentColor: '#f59e0b', fontPairingId: 'classical', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'sharp', shadowPreset: 'none', moodId: 'editorial' },
  { name: 'Zine Punk', primaryColor: '#be185d', secondaryColor: '#f97316', accentColor: '#22d3ee', fontPairingId: 'magazine-cover', colorMode: 'dark', spacingPreset: 'compact', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'bold' },
  { name: 'Longform Sage', primaryColor: '#365314', secondaryColor: '#65a30d', accentColor: '#fef3c7', fontPairingId: 'contemporary', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'subtle', moodId: 'serene' },
]

// ── Travel / Tourism ────────────────────────────────────────────────────────
export const TRAVEL_PRESETS: ThemePreset[] = [
  { name: 'Tropical Escape', primaryColor: '#0891b2', secondaryColor: '#06b6d4', accentColor: '#f59e0b', fontPairingId: 'warm-friendly', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Explorer Dark', primaryColor: '#1e3a5f', secondaryColor: '#2563eb', accentColor: '#22d3ee', fontPairingId: 'geometric', colorMode: 'dark', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'medium', moodId: 'bold' },
  { name: 'Heritage Trail', primaryColor: '#92400e', secondaryColor: '#b45309', accentColor: '#fbbf24', fontPairingId: 'elegant-serif', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'elegant' },
  { name: 'Backpacker Fresh', primaryColor: '#16a34a', secondaryColor: '#65a30d', accentColor: '#f97316', fontPairingId: 'startup-vibe', colorMode: 'light', spacingPreset: 'compact', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'Island Night', primaryColor: '#7c3aed', secondaryColor: '#a78bfa', accentColor: '#fbbf24', fontPairingId: 'creative-studio', colorMode: 'dark', spacingPreset: 'relaxed', borderRadius: 'rounded', shadowPreset: 'dramatic', moodId: 'editorial' },
  // Plan 2253 Phase 02 — 3 new presets
  { name: 'Mountain Lodge', primaryColor: '#14532d', secondaryColor: '#15803d', accentColor: '#fde68a', fontPairingId: 'contemporary', colorMode: 'light', spacingPreset: 'relaxed', borderRadius: 'soft', shadowPreset: 'medium', moodId: 'serene' },
  { name: 'Desert Safari', primaryColor: '#c2410c', secondaryColor: '#ea580c', accentColor: '#fef3c7', fontPairingId: 'warm-editorial', colorMode: 'light', spacingPreset: 'default', borderRadius: 'rounded', shadowPreset: 'subtle', moodId: 'playful' },
  { name: 'City Break', primaryColor: '#475569', secondaryColor: '#94a3b8', accentColor: '#f43f5e', fontPairingId: 'classical', colorMode: 'light', spacingPreset: 'default', borderRadius: 'subtle', shadowPreset: 'subtle', moodId: 'tech-minimal' },
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
