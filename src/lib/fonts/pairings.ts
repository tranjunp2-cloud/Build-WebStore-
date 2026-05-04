export type FontPairing = {
  id: string
  name: string
  category: 'modern' | 'classic' | 'playful' | 'minimal' | 'bold'
  headingFont: string
  bodyFont: string
  headingWeight: number
  bodyWeight: number
  description: string
  sampleText?: string
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'modern-clean',
    name: 'Modern Clean',
    category: 'modern',
    headingFont: 'Inter',
    bodyFont: 'Lora',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Clean sans heading with elegant serif body — versatile contrast',
  },
  {
    id: 'editorial',
    name: 'Editorial',
    category: 'classic',
    headingFont: 'Playfair Display',
    bodyFont: 'Lora',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Elegant editorial style for magazines and luxury brands',
  },
  {
    id: 'tech-forward',
    name: 'Tech Forward',
    category: 'modern',
    headingFont: 'Space Grotesk',
    bodyFont: 'Inter',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Technical and precise, great for tech startups and SaaS',
  },
  {
    id: 'warm-friendly',
    name: 'Warm & Friendly',
    category: 'playful',
    headingFont: 'Nunito',
    bodyFont: 'Nunito Sans',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Approachable and warm, ideal for community and education',
  },
  {
    id: 'bold-impact',
    name: 'Bold Impact',
    category: 'bold',
    headingFont: 'Oswald',
    bodyFont: 'Source Sans 3',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Strong and attention-grabbing for bold brand statements',
  },
  {
    id: 'elegant-serif',
    name: 'Elegant Serif',
    category: 'classic',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Proza Libre',
    headingWeight: 600,
    bodyWeight: 400,
    description: 'Refined elegance for luxury, fashion, and fine dining',
  },
  {
    id: 'startup-vibe',
    name: 'Startup Vibe',
    category: 'modern',
    headingFont: 'Outfit',
    bodyFont: 'DM Sans',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Fresh and contemporary for startups and digital products',
  },
  {
    id: 'creative-studio',
    name: 'Creative Studio',
    category: 'playful',
    headingFont: 'Sora',
    bodyFont: 'Work Sans',
    headingWeight: 600,
    bodyWeight: 400,
    description: 'Creative energy for design studios and agencies',
  },
  {
    id: 'minimal-swiss',
    name: 'Minimal Swiss',
    category: 'minimal',
    headingFont: 'Helvetica Neue',
    bodyFont: 'Inter',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Clean Swiss style minimalism (falls back to system font)',
  },
  {
    id: 'luxury-brand',
    name: 'Luxury Brand',
    category: 'classic',
    headingFont: 'Playfair Display',
    bodyFont: 'Raleway',
    headingWeight: 700,
    bodyWeight: 300,
    description: 'Premium feel for luxury brands and high-end services',
  },
  {
    id: 'geometric',
    name: 'Geometric',
    category: 'modern',
    headingFont: 'Poppins',
    bodyFont: 'Open Sans',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Friendly geometric shapes for wide appeal',
  },
  {
    id: 'humanist',
    name: 'Humanist',
    category: 'minimal',
    headingFont: 'DM Sans',
    bodyFont: 'Karla',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Geometric heading + humanist body for warm minimalism',
  },
  {
    id: 'retro-modern',
    name: 'Retro Modern',
    category: 'playful',
    headingFont: 'Archivo Black',
    bodyFont: 'DM Mono',
    headingWeight: 900,
    bodyWeight: 400,
    description: 'Retro vibes with modern execution',
  },
  {
    id: 'news-editorial',
    name: 'News Editorial',
    category: 'classic',
    headingFont: 'Merriweather',
    bodyFont: 'Source Serif 4',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Traditional editorial for news and publishing',
  },
  {
    id: 'fresh-rounded',
    name: 'Fresh Rounded',
    category: 'playful',
    headingFont: 'Varela Round',
    bodyFont: 'Nunito',
    headingWeight: 400,
    bodyWeight: 400,
    description: 'Soft and friendly rounded letterforms',
  },
  {
    id: 'pro-corporate',
    name: 'Pro Corporate',
    category: 'minimal',
    headingFont: 'Manrope',
    bodyFont: 'Inter',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Professional and clean for corporate and B2B',
  },
  {
    id: 'artisan',
    name: 'Artisan',
    category: 'classic',
    headingFont: 'Lora',
    bodyFont: 'Karla',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Handcrafted feel for artisan brands and boutiques',
  },
  {
    id: 'futuristic',
    name: 'Futuristic',
    category: 'bold',
    headingFont: 'Rajdhani',
    bodyFont: 'Exo 2',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Forward-looking for tech and innovation',
  },
  {
    id: 'cafe-bistro',
    name: 'Cafe & Bistro',
    category: 'playful',
    headingFont: 'Josefin Sans',
    bodyFont: 'Quicksand',
    headingWeight: 600,
    bodyWeight: 400,
    description: 'Casual elegance for cafes and lifestyle brands',
  },
  {
    id: 'bold-geometric',
    name: 'Bold Geometric',
    category: 'bold',
    headingFont: 'Montserrat',
    bodyFont: 'Hind',
    headingWeight: 800,
    bodyWeight: 400,
    description: 'Bold geometric for strong visual impact',
  },
  // ── Plan 2253 Phase 02 — new unique pairs for variety (R6 fix) ──────────
  // Mirrors src/lib/ai/font-pairings.ts resolver additions so that
  // `theme-presets.ts` preset.fontPairingId references stay referentially
  // intact against the authoritative FONT_PAIRINGS array consumed by
  // `src/__tests__/unit/templates/theme-presets.test.ts`.
  {
    id: 'magazine-cover',
    name: 'Magazine Cover',
    category: 'classic',
    headingFont: 'Playfair Display',
    bodyFont: 'Open Sans',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Editorial magazine cover — serif headline + neutral body',
  },
  {
    id: 'boutique-serif',
    name: 'Boutique Serif',
    category: 'classic',
    headingFont: 'Playfair Display',
    bodyFont: 'Inter',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Boutique luxury — classic serif headlines with modern body',
  },
  {
    id: 'warm-editorial',
    name: 'Warm Editorial',
    category: 'playful',
    headingFont: 'Poppins',
    bodyFont: 'Nunito',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Warm rounded headlines with friendly editorial body',
  },
  {
    id: 'contemporary',
    name: 'Contemporary',
    category: 'modern',
    headingFont: 'Raleway',
    bodyFont: 'DM Sans',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Contemporary clean — Raleway headlines with geometric body',
  },
  {
    id: 'classical',
    name: 'Classical',
    category: 'classic',
    headingFont: 'Inter',
    bodyFont: 'Open Sans',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Refined neutral pairing for classical, timeless brands',
  },
  {
    id: 'hospitality',
    name: 'Hospitality',
    category: 'playful',
    headingFont: 'Poppins',
    bodyFont: 'Open Sans',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Welcoming hospitality — rounded headlines with clean body',
  },
]

/** System fonts that should not be loaded from Google Fonts */
const SYSTEM_FONTS = ['Helvetica Neue', 'Arial', 'system-ui']

// ── next/font CSS Variable Mapping ──────────────────────────────────────────
// Maps font display names (used in FONT_PAIRINGS) to the CSS variable names
// declared by `next/font/google` imports in `src/components/AppShell.tsx`.
//
// Why this exists: `next/font` self-hosts woff2 files and exposes them ONLY
// via scoped CSS variables (e.g. `--font-playfair-display`). The family name
// 'Playfair Display' is NOT globally registered, so `font-family: 'Playfair
// Display'` in theme CSS falls back to system font. Theme resolver must
// output `var(--font-playfair-display)` instead.
//
// Keep this map in sync with AppShell.tsx next/font imports. If you add a
// new pairing that references an unloaded font, add both (a) the next/font
// import in AppShell and (b) the entry below.
export const FONT_CSS_VAR_MAP: Readonly<Record<string, string>> = {
  // Base (always loaded, Vietnamese subset)
  'Inter': '--font-inter',
  'Outfit': '--font-outfit',

  // Pairing fonts (20 pairings cover these)
  'Lora': '--font-lora',
  'Playfair Display': '--font-playfair-display',
  'Space Grotesk': '--font-space-grotesk',
  'Nunito': '--font-nunito',
  'Nunito Sans': '--font-nunito-sans',
  'Oswald': '--font-oswald',
  'Source Sans 3': '--font-source-sans-3',
  'Cormorant Garamond': '--font-cormorant-garamond',
  'Proza Libre': '--font-proza-libre',
  'DM Sans': '--font-dm-sans',
  'Sora': '--font-sora',
  'Work Sans': '--font-work-sans',
  'Raleway': '--font-raleway',
  'Poppins': '--font-poppins',
  'Open Sans': '--font-open-sans',
  'Karla': '--font-karla',
  'Archivo Black': '--font-archivo-black',
  'DM Mono': '--font-dm-mono',
  'Merriweather': '--font-merriweather',
  'Source Serif 4': '--font-source-serif-4',
  'Varela Round': '--font-varela-round',
  'Manrope': '--font-manrope',
  'Rajdhani': '--font-rajdhani',
  'Exo 2': '--font-exo-2',
  'Josefin Sans': '--font-josefin-sans',
  'Quicksand': '--font-quicksand',
  'Montserrat': '--font-montserrat',
  'Hind': '--font-hind',
  'Lato': '--font-lato',
} as const

/** Default CSS vars guaranteed loaded (for fallback chains) */
export const DEFAULT_HEADING_VAR = '--font-outfit'
export const DEFAULT_BODY_VAR = '--font-inter'

/**
 * Convert a font display name → a `font-family` CSS value that prefers the
 * `next/font` scoped variable, then falls back to the always-loaded default
 * (`--font-outfit` for heading, `--font-inter` for body), then system fonts.
 *
 * Usage inside `generateThemeCSS()`:
 *   --font-heading: ${fontNameToCSSVar(theme.fontHeading, 'heading')};
 *
 * For unknown fonts (not in FONT_CSS_VAR_MAP), the name is still quoted as
 * a system fallback hint — if the user happens to have it installed locally
 * or loaded externally it will apply, otherwise the default var handles it.
 */
export function fontNameToCSSVar(
  fontName: string,
  role: 'heading' | 'body',
): string {
  const trimmed = fontName.trim()
  const defaultVar = role === 'heading' ? DEFAULT_HEADING_VAR : DEFAULT_BODY_VAR
  const knownVar = FONT_CSS_VAR_MAP[trimmed]
  const systemFallback = role === 'heading' ? "'Outfit', sans-serif" : "'Inter', sans-serif"

  if (knownVar) {
    const quoted = /\s/.test(trimmed) ? `'${trimmed}'` : trimmed
    return `${quoted}, var(${knownVar}), var(${defaultVar}), ${systemFallback}`
  }

  // Unknown font — quote and try system, fall back to default loaded var
  const quoted = /\s/.test(trimmed) ? `'${trimmed}'` : trimmed
  return `${quoted}, var(${defaultVar}), ${systemFallback}`
}

// ── Pairing Validation ──────────────────────────────────────────────────────
// Prevents "AI slop" — same-font pairings look generic (no contrast axis).

/** Blocked font combinations — same font for heading and body removes contrast */
export const BLOCKED_PAIRINGS: ReadonlyArray<readonly [string, string]> = [
  ['Inter', 'Inter'],
  ['DM Sans', 'DM Sans'],
  ['Poppins', 'Poppins'],
  ['Outfit', 'Outfit'],
  ['Manrope', 'Manrope'],
  ['Work Sans', 'Work Sans'],
] as const

export function isBlockedPairing(headingFont: string, bodyFont: string): boolean {
  const h = headingFont.trim().toLowerCase()
  const b = bodyFont.trim().toLowerCase()
  return BLOCKED_PAIRINGS.some(
    ([blockedH, blockedB]) =>
      blockedH.toLowerCase() === h && blockedB.toLowerCase() === b,
  )
}

export type FontPairingValidation = {
  valid: boolean
  reason?: string
}

/**
 * Validates a font pairing against contrast-axis rules.
 * - Same font for heading + body → invalid (no contrast)
 * - Explicitly blocked combos → invalid
 */
export function validateFontPairing(
  headingFont: string,
  bodyFont: string,
): FontPairingValidation {
  const h = headingFont.trim()
  const b = bodyFont.trim()

  if (!h || !b) {
    return { valid: false, reason: 'missing-font' }
  }

  if (h.toLowerCase() === b.toLowerCase()) {
    return {
      valid: false,
      reason: `same-font: ${h} heading + ${b} body has no contrast axis`,
    }
  }

  if (isBlockedPairing(h, b)) {
    return {
      valid: false,
      reason: `blocked-pair: ${h} + ${b} is in BLOCKED_PAIRINGS list`,
    }
  }

  return { valid: true }
}

/** Validates a FontPairing object (convenience wrapper) */
export function validateFontPairingObject(pairing: FontPairing): FontPairingValidation {
  return validateFontPairing(pairing.headingFont, pairing.bodyFont)
}

export function getFontPairing(id: string): FontPairing | undefined {
  return FONT_PAIRINGS.find((p) => p.id === id)
}

export function getFontsByCategory(
  category: FontPairing['category'],
): FontPairing[] {
  return FONT_PAIRINGS.filter((p) => p.category === category)
}

export function getGoogleFontsUrl(pairing: FontPairing): string {
  const fonts: string[] = []

  const addFont = (family: string, weights: number[]) => {
    if (SYSTEM_FONTS.includes(family)) return
    fonts.push(
      `family=${family.replace(/ /g, '+')}:wght@${weights.join(';')}`,
    )
  }

  addFont(pairing.headingFont, [pairing.headingWeight])
  if (pairing.headingFont !== pairing.bodyFont) {
    addFont(pairing.bodyFont, [pairing.bodyWeight])
  }

  return `https://fonts.googleapis.com/css2?${fonts.join('&')}&display=swap`
}

/** Get all unique font families needed for a pairing */
export function getFontFamilies(pairing: FontPairing): string[] {
  const families = [pairing.headingFont]
  if (pairing.bodyFont !== pairing.headingFont) {
    families.push(pairing.bodyFont)
  }
  return families
}
