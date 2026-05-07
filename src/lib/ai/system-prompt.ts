/**
 * AI System Prompt Builder
 * Builds the system prompt for GPT-4o using block registry metadata.
 * This ensures AI only generates valid block types with correct schemas.
 */

import { blockRegistry } from '@/blocks/registry'
import type { ThemePreset } from './theme-presets'
import { resolveFontPairing } from './font-pairings'
import { THEME_MOODS } from './theme-moods'
import { isUnsupportedBlock } from './unsupported-blocks'

// ── Theme context for soft guidance injection ─────────────────────────────

export type ThemePromptContext = {
  preset: ThemePreset
  category: string
}

/**
 * Describe the mood a preset should set so AI copy (CTAs, taglines, headings)
 * matches the palette.
 *
 * Plan 260414-2249 phase-02: delegates to `THEME_MOODS[preset.moodId]` which
 * is the single source of truth for mood metadata (voiceStyle rules, imagery,
 * CTAs). The old category×colorMode classification is gone — mood is now a
 * FIRST-CLASS property of each preset, not derived at call time.
 *
 * `category` kept in signature for backward compat (some call sites still
 * pass it) but unused — mood encodes everything needed.
 */
function moodHint(preset: ThemePreset, _category: string): string {
  const mood = THEME_MOODS[preset.moodId]
  if (!mood) {
    // Defensive fallback — preset missing moodId (shouldn't happen post-phase-02)
    return 'polished, professional, approachable — benefit-led, specific'
  }
  return `${mood.label.toLowerCase()} — ${mood.description}`
}

// Plan 2253 follow-up (audit-unused-code) — deleted ~130 lines of dead code:
//   - STYLE_PERSONALITIES (empty array, deprecated by plan 2249 phase-02)
//   - selectPersonality() (deprecated shim, no callers post-cleanup)
//   - generateCompositionHint() + CATEGORY_SIGNATURE_BLOCKS + COMMON_BLOCKS
//     + HERO_VARIANTS_BY_CATEGORY + FOOTER_VARIANTS (R12 soft hint ignored
//     by GPT-4o; superseded by plan 2249 phase-04 `recipe` hard directive
//     injection in buildUserPrompt)
//   - CATEGORY_HINTS (only consumed by generateCompositionHint's legacy
//     fallback branch, no longer needed)
//   - pickFrom / shuffle (local helpers only used by generateCompositionHint)
// See plans/260414-2253-ai-gen-variety-root-cause/reports/audit-unused-code.md

export function buildSystemPrompt(
  language: 'en' | 'ms' | 'vi' | 'auto' = 'auto',
  themeContext?: ThemePromptContext,
): string {
  // Plan 2253 audit-unused-code — filter out editor-only blocks (aiVisible=false)
  // so GPT-4o prompt lists only blocks the AI should actually output. Blocks
  // like divider/breadcrumb/whatsapp-button/cart-widget are still available in
  // the editor library UI for manual user drag-drop, just hidden from AI.
  //
  // Plan 260415 F01-gen-audit — also drop blocks on the unsupported list.
  // (Plan 260422-1900: booking-widget, before-after re-enabled; now only
  // menu-display and review-cards remain on unsupported list.)
  // Filter at prompt-build time so GPT never sees unsupported blocks.
  const blockMetas = blockRegistry
    .getAllMeta()
    .filter((m) => m.aiVisible !== false && !isUnsupportedBlock(m.type))

  const blockList = blockMetas.map(m =>
    `- **${m.type}** (${m.name}): ${m.description}. Variants: [${m.variants.join(', ')}]. Fields: ${m.editableFields.join(', ')}`
  ).join('\n')

  // Unused locale parameter placeholder — suppress TS lint without affecting runtime.
  void language

  const themeSection = themeContext
    ? (() => {
        const { preset, category } = themeContext
        const fontPair = resolveFontPairing(preset.fontPairingId)
        return `

## REQUIRED THEME (use these EXACT values in your \`theme\` object — do NOT invent different colors)
\`\`\`json
{
  "primaryColor": "${preset.primaryColor}",
  "secondaryColor": "${preset.secondaryColor}",
  "fontHeading": "${fontPair.fontHeading}",
  "fontBody": "${fontPair.fontBody}",
  "colorMode": "${preset.colorMode}"
}
\`\`\`
Preset name: "${preset.name}" — curated for ${category} businesses.
Mood: ${moodHint(preset, category)}.
Write hero headlines, section titles, and CTA copy that reinforces this mood. Do NOT default to generic blue/purple.
Spacing: "${preset.spacingPreset}" — apply this consistently across ALL pages. When "relaxed", sections should feel open and airy; when "compact", sections should feel tight and dense; when "default", use standard spacing. NEVER mix spacing styles within the same website.
`
      })()
    : ''

  // NOTE: 'video-showcase' removed from VARIETY RULES #6 — temporarily hidden (aiVisible: false, archived). Re-add when block is production-ready.
  return `You are an expert website designer AI. Your job is to generate a complete website from a user's business description.${themeSection}

## OUTPUT FORMAT
You MUST respond with a valid JSON object in this exact format:
{
  "siteName": "Business Name",
  "category": "business|ecommerce|restaurant|portfolio|blog",
  "theme": {
    "primaryColor": "#HEX",
    "secondaryColor": "#HEX",
    "fontHeading": "Google Font Name",
    "fontBody": "Google Font Name",
    "colorMode": "light|dark"
  },
  "seo": {
    "title": "Homepage title (max 60 chars)",
    "description": "Homepage meta description (max 160 chars)"
  },
  "language": "en|ms|vi",
  "pages": [
    {
      "title": "Homepage",
      "slug": "/",
      "isHomepage": true,
      "blocks": [
        { "blockType": "navigation", "variant": "simple", ... },
        { "blockType": "hero", "variant": "centered", ... },
        ...
      ],
      "seo": { "title": "...", "description": "..." }
    },
    {
      "title": "About Us",
      "slug": "about",
      "isHomepage": false,
      "blocks": [ ... ],
      "seo": { "title": "About - Business Name", "description": "..." }
    },
    {
      "title": "Services",
      "slug": "services",
      "isHomepage": false,
      "blocks": [ ... ],
      "seo": { "title": "Services - Business Name", "description": "..." }
    },
    {
      "title": "Contact",
      "slug": "contact",
      "isHomepage": false,
      "blocks": [ ... ],
      "seo": { "title": "Contact - Business Name", "description": "..." }
    }
  ]
}

NOTE: For backward compatibility, "blocks" at the root level is also accepted (treated as single homepage).

## AVAILABLE BLOCK TYPES (${blockMetas.length} total)
${blockList}

## STRUCTURE RULES
1. Generate 5 pages: Homepage (8-14 blocks), About (4-6 blocks), Services/Products (4-6 blocks), Contact (4-6 blocks), Blog (4-6 blocks with 3-5 seeded posts)
2. Every page MUST have at least 4 blocks with non-empty body copy — no stub pages
3. Each page MUST share navigation and footer blocks but have UNIQUE content blocks
4. Each block MUST have "blockType" and "variant" fields
5. blockType MUST be one of the listed types — no custom types
6. variant MUST be one of the listed variants for that block type
7. For 'socials' field in footer/team, use array of objects: [{"platform": "facebook", "url": "..."}]
8. Blog page MUST include blog-list block with ≥3 posts (title + excerpt + slug + readTime)
9. PAGE SLUGS ARE FIXED — use EXACTLY these slugs regardless of business type: Homepage → "/", About page → "about", Contact page → "contact", Blog page → "blog". NEVER invent slugs like "free-trial", "get-started", "sign-up" for these canonical pages.

## LANGUAGE DETECTION
- Bahasa Melayu input → ALL text in formal Bahasa Melayu (\`"language": "ms"\`)
- Vietnamese input → ALL text in professional Vietnamese (\`"language": "vi"\`)
- English/Manglish input → ALL text in English (\`"language": "en"\`)
- Unsupported language (Tamil, Mandarin) → fallback to English
- Vietnamese slang/abbreviations → interpret and generate professional Vietnamese
  Example: "ban banh mi ship tan noi" → Bakery/restaurant selling bánh mì with delivery

## PROFESSIONAL DESIGN RULES (CRITICAL — these make websites look hand-designed, not AI-generated)

### Hero Section
- Headline: 5-8 words max. Benefit-focused, mentions business name or core value.
- Subheadline: 12-20 words max. Expands with specifics.
- 1 primary CTA button (action verb + benefit: "Book a Table", "Get Started Free"). 1 optional secondary CTA (outlined/ghost).
- NEVER use "Submit", "Click Here", or "Welcome to our website" as CTA text.
- Match hero variant to design personality: dramatic → fullscreen/parallax, professional → centered/gradient, creative → magazine/cards-overlay, warm → split-left/split-right.

### Color System (60-30-10 Rule)
- 60% dominant: backgrounds, large surfaces (light neutral or subtle brand tint)
- 30% secondary: nav, cards, section backgrounds
- 10% accent: CTA buttons, links, highlights — draws eye via SCARCITY
- Maximum 3 core colors + neutrals. CTA MUST use accent color.
- NEVER use pure black (#000000) for text — use #1a1a2e or brand-tinted dark
- Dark mode: invert surface/text, desaturate accent slightly

### Typography
- Exactly 2 fonts: 1 heading (display/personality), 1 body (readability)
- Create CONTRAST between heading/body: serif+sans, geometric+humanist, condensed+wide
- Heading weight: 600-800. Body weight: 400.
- AVOID overused AI defaults: Inter for both, DM Sans for both, Poppins everywhere
- Good pairings: Playfair Display + Lato, Outfit + Inter, Raleway + Open Sans, DM Sans + Nunito

### Section Ordering (AIDA Conversion Funnel)
Follow this general flow but VARY the middle sections:
1. Navigation — sticky, logo left, CTA button right
2. Hero — value proposition, primary CTA (ABOVE THE FOLD)
3. Trust bar (logo-cloud/social-proof) or Features — immediately establish credibility
4-9. MIDDLE SECTION (vary order): features, industry-specific blocks, stats, testimonials, gallery, pricing, FAQ, newsletter, team
10. Contact + Footer

ORDERING RULES:
- Social proof (testimonials, stats, logos) AFTER explaining value (features), BEFORE asking for money (pricing/CTA)
- Place a CTA block every 3-4 sections. First in hero, mid-page, and before footer.
- NEVER place two text-heavy sections back-to-back. Alternate: text-heavy → visual-heavy → text-heavy
- Features MUST come before stats (stats need context)

### Content Quality
- Hero headline must mention the ACTUAL business name — never generic
- Features must list ACTUAL products/services from user input — never generic "Quality Service"
- Testimonials must sound realistic for the SPECIFIC industry with name, role, company
- Section titles: 3-7 words, paired with 1-sentence subtitle
- Short paragraphs: 2-3 sentences max. Use bullet points for 3+ items.
- CTA text: action verb + benefit ("Book a Table", "View Our Menu", "Get Free Consultation")

### Anti-Patterns (DO NOT generate these)
- Purple/indigo gradients as default (the #1 sign of AI-generated sites)
- Three identical icon-grid cards as the only features section
- Cards nested inside cards
- Same font for heading AND body (e.g., Inter + Inter)
- Generic stock photo descriptions ("professional team working together")
- "Welcome to our website" or "We are the best" headlines
- All sections centered with same padding — create RHYTHM by varying alignment and spacing

## VARIETY RULES
1. NEVER default to the first variant in the list. Deliberately choose from the FULL range.
2. Hero has 12 variants — use them ALL across generations. Do NOT always use "centered".
3. Features has 8 variants — do NOT always use "grid-3". Try zigzag, carousel, icon-left, list.
4. Testimonials has 8 variants — try spotlight, masonry, avatar-row, not just "cards".
5. Footer has 4 variants — vary between simple, minimal, centered-stack, dark-gradient.
6. Include at least ONE uncommon block on homepage: step-process, before-after, countdown-timer, or social-proof.
7. Block ORDER must vary — do NOT always put features directly after hero.

## IMPORTANT
- Respond ONLY with the JSON object, no markdown, no explanation
- Content must feel SPECIFIC to this business — not template filler
- Theme should match the business personality, not default to blue/purple

## REFERENCE MODE (when reference content is provided)
When the user prompt includes a "REFERENCE CONTENT" section:
- Use the EXACT headlines, descriptions, and feature text from the reference — do NOT rewrite or paraphrase
- Match the section ORDER from suggestedBlocks (hero first, then features, etc.)
- Adapt testimonials and pricing to our block schema but KEEP the original text
- Use the visual style hints (primaryColor, secondaryColor, mood) for theme
- Only generate NEW content for sections NOT in the reference
- Hero headline MUST be the exact text from reference heroHeadline
- Features MUST use the exact titles and descriptions from reference featuresList
- This is a RECREATION of an existing website, not a new creative design`
}

export type BusinessInfoInput = {
  businessName: string
  industry: string
  products: string
  shortDescription: string
  // User-supplied optional fields (plan 260414-2249 phase-01). Wire-level ephemeral
  // — phone/email/address flow into composer via mapBusinessInfo() and override
  // canned BusinessSample fields. tagline falls back to shortDescription slice.
  tagline?: string
  phone?: string
  email?: string
  address?: string
}

import type { ThemeMood } from './theme-moods'
import type { CategoryRecipe } from './category-recipes'
import { SUGGESTED_CTA_BY_CATEGORY } from './suggested-cta-by-category'

export type BuildUserPromptOptions = {
  extraInstructions?: string
  language?: 'en' | 'ms' | 'vi' | 'auto'
  referencePrompt?: string
  /** Plan 260414-2249 phase-02: bundled voice/imagery/CTA archetype. */
  mood?: ThemeMood
  /**
   * Plan 260414-2249 phase-04: ordered block sequence hard constraint.
   * When provided, replaces the legacy `generateCompositionHint`
   * category signature with an explicit RHYTHM section in the user
   * prompt — tells GPT the exact order of blocks to emit.
   */
  recipe?: CategoryRecipe
  /**
   * Phase P3 — per-template block prompt overrides.
   * When an admin has set a custom prompt for a block in a specific template,
   * inject it as an additional BLOCK OVERRIDES section so GPT tailors
   * content for that block to match the override instructions.
   * Shape: { [blockSlug]: { prompt: string } }
   */
  blockPromptOverrides?: Record<string, { prompt: string }>
  /**
   * Plan 260429-1032 Phase 5 — resolved composer category (e.g. "restaurant",
   * "education"). When provided, injects preferred CTA labels for this category
   * so GPT avoids generic fallbacks like "Xem thêm" or "Learn More".
   */
  category?: string
}

export function buildUserPrompt(
  info: BusinessInfoInput,
  extraInstructionsOrOptions?: string | BuildUserPromptOptions,
  language: 'en' | 'ms' | 'vi' | 'auto' = 'auto',
  referencePrompt?: string,
): string {
  // Backward-compat: legacy positional args (string, lang, referencePrompt)
  // OR new options object. Normalize.
  let extraInstructions: string | undefined
  let mood: ThemeMood | undefined
  let recipe: CategoryRecipe | undefined
  let blockPromptOverrides: Record<string, { prompt: string }> | undefined
  let category: string | undefined
  if (typeof extraInstructionsOrOptions === 'string' || extraInstructionsOrOptions === undefined) {
    extraInstructions = extraInstructionsOrOptions
  } else {
    extraInstructions = extraInstructionsOrOptions.extraInstructions
    mood = extraInstructionsOrOptions.mood
    recipe = extraInstructionsOrOptions.recipe
    blockPromptOverrides = extraInstructionsOrOptions.blockPromptOverrides
    category = extraInstructionsOrOptions.category
    if (extraInstructionsOrOptions.language) language = extraInstructionsOrOptions.language
    if (extraInstructionsOrOptions.referencePrompt) referencePrompt = extraInstructionsOrOptions.referencePrompt
  }
  const parts = [
    `Create a complete website for: "${info.businessName}"`,
    `Industry: ${info.industry}`,
    `Main products/services: ${info.products}`,
    `Business description: ${info.shortDescription}`,
  ]
  // Plan 260414-2249 phase-01: forward user-supplied contact + tagline so
  // GPT happy-path output mirrors what the composer fallback emits.
  if (info.tagline && info.tagline.trim()) {
    parts.push(`Tagline: ${info.tagline.trim()}`)
  }
  if (info.phone && info.phone.trim()) {
    parts.push(`Contact phone: ${info.phone.trim()} (use this verbatim in any contact block)`)
  }
  if (info.email && info.email.trim()) {
    parts.push(`Contact email: ${info.email.trim()} (use this verbatim)`)
  }
  if (info.address && info.address.trim()) {
    parts.push(`Physical address: ${info.address.trim()} (use this verbatim)`)
  }
  if (extraInstructions) {
    parts.push(`Additional instructions: ${extraInstructions}`)
  }

  // Plan 260414-2249 phase-02: inject mood-driven COPY VOICE block.
  // When a mood is provided, it replaces the legacy one-sentence personality
  // with 4-5 bulleted voice rules + imagery adjectives + copy tone label.
  //
  // When no mood is supplied (legacy callers), no personality block is added
  // at all — the previous STYLE_PERSONALITIES fallback is deprecated. Current
  // openai-generator.ts always passes mood after the GAP 1 fix.
  if (!referencePrompt && mood) {
    const voiceBullets = mood.voiceStyle.map((rule) => `  - ${rule}`).join('\n')
    parts.push(
      `\nCOPY VOICE (${mood.label} / ${mood.copyTone}):\n${voiceBullets}\n  - Imagery mood: ${mood.imageryKeywords.slice(0, 3).join(', ')}.`,
    )
  }

  // Plan 260414-2249 phase-04: inject ordered RHYTHM section when a recipe
  // is provided. This is a HARD constraint (not "feel free to modify") —
  // GPT should produce blocks in this exact order. Replaces the legacy
  // generateCompositionHint which used a shuffled CATEGORY_SIGNATURE_BLOCKS
  // lookup (deleted by Plan 2253 follow-up audit-unused-code cleanup).
  if (!referencePrompt && recipe) {
    const sequence = recipe.blocks.join(' → ')
    const required = recipe.required.join(', ')
    parts.push(
      `\nRHYTHM: ${recipe.label} (${recipe.rhythm})\nBlock sequence: ${sequence}\nRequired blocks (must be present): ${required}\nRationale: ${recipe.description}\nIMPORTANT: Emit blocks in this exact order. You may omit optional blocks but do not reorder them.`,
    )
  }

  // Phase P3 — inject per-block prompt overrides when present.
  // Each override is appended as a targeted instruction so GPT tailors content
  // for that specific block type. Skipped for reference-prompt path (recreation
  // mode should follow the source content, not custom prompts).
  if (!referencePrompt && blockPromptOverrides) {
    const overrideEntries = Object.entries(blockPromptOverrides).filter(([, v]) => v?.prompt?.trim())
    if (overrideEntries.length > 0) {
      const lines = overrideEntries.map(([slug, v]) => `  - **${slug}**: ${v.prompt.trim()}`)
      parts.push(
        `\nBLOCK OVERRIDES (apply these specific instructions when generating each named block):\n${lines.join('\n')}`,
      )
    }
  }

  // Plan 260429-1032 Phase 5 — inject per-category CTA hint so GPT picks
  // industry-specific CTAs instead of generic "Xem thêm" / "Learn More".
  // Skipped for reference-prompt path (recreation mode uses source content).
  if (!referencePrompt && category) {
    const suggestedCtaList = SUGGESTED_CTA_BY_CATEGORY[category]
    if (suggestedCtaList && suggestedCtaList.length > 0) {
      parts.push(
        `\nPREFERRED CTA LABELS for ${category} (use these in hero, navigation, and CTA blocks):\n${suggestedCtaList.map((c) => `  - "${c}"`).join('\n')}\nAvoid generic labels like: learn more, read more, click here, xem thêm, tìm hiểu thêm, đọc thêm`,
      )
    }
  }

  // Append reference content from ContentBrief (URL/Image extraction)
  if (referencePrompt) {
    parts.push(referencePrompt)
    parts.push('\nIMPORTANT: Use the EXACT text from the REFERENCE CONTENT above. Do NOT invent new content or paraphrase. This is a recreation of an existing website.')
  }

  const langInstruction = language === 'auto'
    ? "Auto-detect the language from the input and generate the site in that same language (fallback to English if unsupported)."
    : `Generate in ${language === 'ms' ? 'Malay (Bahasa Melayu)' : language === 'vi' ? 'Vietnamese' : 'English'}.`

  parts.push(`\n${langInstruction} Make it look premium and professional.`)

  return parts.join('\n')
}

/**
 * Lightweight prompt for template-first pipeline. GPT only personalizes
 * 4 fields: hero headline, hero subheadline, SEO title, SEO description.
 * ~200 tokens input → ~80 tokens output → 2-3s with gpt-4.1-nano.
 */
export function buildPersonalizePrompt(
  info: BusinessInfoInput,
  category: string,
  language: 'en' | 'ms' | 'vi',
): { system: string; user: string } {
  const langLabel = language === 'ms' ? 'Malay (Bahasa Melayu)'
    : language === 'vi' ? 'Vietnamese' : 'English'

  return {
    system: `You personalize website copy for a ${category} business. Return ONLY valid JSON:
{
  "heroHeadline": "5-8 words, benefit-focused, mention business name",
  "heroSubheadline": "12-20 words expanding on the headline with specifics",
  "seoTitle": "max 60 chars, includes business name",
  "seoDescription": "max 160 chars, compelling meta description"
}
Write in ${langLabel}. Be specific to this business — no generic phrases like "Quality Service" or "Welcome to our website".`,
    user: `Business: "${info.businessName}"
Industry: ${info.industry}
Products/services: ${info.products}
Description: ${info.shortDescription}`,
  }
}
