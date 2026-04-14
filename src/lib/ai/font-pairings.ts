/**
 * Font pairing resolver for fallback composer.
 * Maps ThemePreset.fontPairingId → concrete { fontHeading, fontBody } family names.
 *
 * Allowlist constraint (must match openai-generator.ts validation):
 *   Heading: Outfit, Inter, Playfair Display, DM Sans, Poppins, Raleway
 *   Body:    Inter, DM Sans, Lato, Open Sans, Nunito
 */

export type ResolvedFontPairing = {
    fontHeading: string
    fontBody: string
}

const DEFAULT_PAIRING: ResolvedFontPairing = { fontHeading: 'Inter', fontBody: 'Inter' }

const FONT_PAIRINGS: Record<string, ResolvedFontPairing> = {
    'warm-friendly':   { fontHeading: 'Poppins',          fontBody: 'Nunito' },
    'modern-clean':    { fontHeading: 'DM Sans',          fontBody: 'Inter' },
    'elegant-serif':   { fontHeading: 'Playfair Display', fontBody: 'Lato' },
    'luxury-brand':    { fontHeading: 'Playfair Display', fontBody: 'DM Sans' },
    'pro-corporate':   { fontHeading: 'DM Sans',          fontBody: 'Open Sans' },
    'bold-impact':     { fontHeading: 'Outfit',           fontBody: 'Inter' },
    'tech-forward':    { fontHeading: 'Outfit',           fontBody: 'DM Sans' },
    'startup-vibe':    { fontHeading: 'Poppins',          fontBody: 'Inter' },
    'minimal-swiss':   { fontHeading: 'Inter',            fontBody: 'Inter' },
    'geometric':       { fontHeading: 'Outfit',           fontBody: 'DM Sans' },
    'fresh-rounded':   { fontHeading: 'Poppins',          fontBody: 'Nunito' },
    'humanist':        { fontHeading: 'Raleway',          fontBody: 'Open Sans' },
    'cafe-bistro':     { fontHeading: 'Playfair Display', fontBody: 'Lato' },
    'artisan':         { fontHeading: 'Playfair Display', fontBody: 'Nunito' },
    'editorial':       { fontHeading: 'Playfair Display', fontBody: 'Lato' },
    'futuristic':      { fontHeading: 'Outfit',           fontBody: 'DM Sans' },
    'creative-studio': { fontHeading: 'Raleway',          fontBody: 'Inter' },
    'retro-modern':    { fontHeading: 'Raleway',          fontBody: 'Nunito' },
    'bold-geometric':  { fontHeading: 'Outfit',           fontBody: 'DM Sans' },
}

/**
 * Resolve a font pairing id to concrete font family names.
 * Unknown id → default (Inter/Inter) + console.warn.
 */
export function resolveFontPairing(id: string): ResolvedFontPairing {
    const pair = FONT_PAIRINGS[id]
    if (!pair) {
        console.warn(`[font-pairings] Unknown pairing id "${id}" — using default Inter/Inter`)
        return DEFAULT_PAIRING
    }
    return pair
}

// Exported for tests — consumers should use resolveFontPairing()
export const __FONT_PAIRINGS_FOR_TEST = FONT_PAIRINGS
