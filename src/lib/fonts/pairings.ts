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
    bodyFont: 'Inter',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Clean and versatile, perfect for any modern website',
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
    bodyFont: 'DM Sans',
    headingWeight: 700,
    bodyWeight: 400,
    description: 'Warm minimalism with humanist touches',
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
]

/** System fonts that should not be loaded from Google Fonts */
const SYSTEM_FONTS = ['Helvetica Neue', 'Arial', 'system-ui']

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
