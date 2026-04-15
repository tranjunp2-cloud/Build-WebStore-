# Researcher 01 — Shape Adapter & Category Mapping

Scope: map `TemplateSeed` (composer) → `GenerationResult` (generator) for fallback refactor.

## Q1: Type shape diff

`GenerationResult` is defined at `src/lib/ai/generate-blocks.ts:34-48`.
`TemplateSeed` is defined at `src/lib/ai/template-composer.ts:67-82`.
`TemplatePage` at `src/lib/ai/template-composer.ts:78-82` uses `layout: Record<string, unknown>[]` (composer) while `GeneratedPage` uses `blocks: GeneratedBlock[]` (generator, `generate-blocks.ts:26-32`).

| GenerationResult field | TemplateSeed source | Adapter logic |
|---|---|---|
| `siteName` | `biz.name` (not `seed.name` — that is `"${biz.name} — ${themePreset.name}"`, see `template-composer.ts:1243`) | Pass user-extracted prompt name if present, else `biz.name`. Do NOT use `seed.name`. |
| `siteType` | `seed.category` | 14→5 mapping table (see Q2). |
| `blocks` | `seed.pages[0].layout` | Rename `layout` → `blocks`. Shape is already `Record<string, unknown>[]` with `blockType` key — compatible with `GeneratedBlock`. |
| `pages` (optional) | `seed.pages[]` | Map each: `{ title, slug, isHomepage: idx===0, blocks: page.layout, seo: {…derived} }`. Composer has no per-page SEO — synthesize from `biz.tagline` + `page.title`. |
| `seo.title` | none — must synthesize | `\`${biz.name} — ${biz.tagline}\`` |
| `seo.description` | `biz.description` or `seed.description` | Pass-through, truncate to 160 chars. |
| `language` | none | Composer hardcodes `templateLang: 'en'` (`template-composer.ts:1249`). Fallback must derive from prompt (reuse `parseIntent`-like detection) or default `'en'`. |
| `theme.primaryColor` | `seed.theme.primaryColor` | Direct. |
| `theme.secondaryColor` | `seed.theme.secondaryColor` | Direct. |
| `theme.fontHeading` | `seed.theme.fontPairingId` | NOT direct — `ThemePreset` only stores a `fontPairingId` string (e.g. `'warm-friendly'`), not concrete font family names. Adapter must resolve the pairing ID to `{fontHeading, fontBody}`. Need a lookup table (search for font-pairings map or hardcode common 5-10 pairs). |
| `theme.fontBody` | same pairing lookup | See above. |
| `theme.colorMode` | `seed.theme.colorMode` | Direct. |

Composer-only fields dropped: `seed.description`, `seed.tier`, `seed.isPremium`, `seed.thumbnail`, `theme.accentColor`, `theme.spacingPreset`, `theme.borderRadius`, `theme.shadowPreset` (`theme-presets.ts:4-14`).

## Q2: Category mapping

All 14 composer categories (from `categoryMap` in `src/lib/ai/content/index.ts:42-57`):
`restaurant, ecommerce, beauty, tech, health, education, realestate, fitness, creative, business, fnb, events, travel, blog`.

`BusinessIntent.type` has 5 values (`generate-blocks.ts:16`): `business | ecommerce | restaurant | portfolio | blog`.

Reverse mapping (5 generator types → 1 composer category):
| Generator type | Composer category | Rationale |
|---|---|---|
| `restaurant` | `restaurant` | 1:1 |
| `ecommerce` | `ecommerce` | 1:1 |
| `blog` | `blog` | 1:1 |
| `portfolio` | `creative` | closest match (portfolio is subset of creative) |
| `business` | `business` | default fallback |

`parseIntent()` (`generate-blocks.ts:83-116`) scores prompt against `TYPE_KEYWORDS` (`:75-81`) — only 5 buckets, missing keywords for beauty/tech/health/education/realestate/fitness/fnb/events/travel. Many of these are currently bucketed under `business` (e.g. `spa`, `gym`, `clinic`, `dental`).

**Proposed prompt → 14-category translator:** extend `TYPE_KEYWORDS` to 14 keys with keyword sets per category. Highest-score wins. Example seeds:
- `beauty`: spa, salon, beauty, skincare, cosmetic, nail, hair
- `health`: clinic, dental, doctor, medical, hospital, pharmacy
- `fitness`: gym, fitness, yoga, pilates, crossfit, martial arts
- `realestate`: real estate, property, agent, condo, apartment
- `education`: school, academy, tuition, course, training, kindergarten
- `tech`: saas, software, app, platform, startup, ai
- `fnb`: cafe, coffee, bakery, bubble tea, kopitiam, dessert (overlaps restaurant — fnb is non-dine-in)
- `events`: wedding, event, party, photography, venue
- `travel`: travel, tour, hotel, resort, homestay, agency
- `creative`: portfolio, photographer, designer, artist, freelance

Categories with no direct 1:1 keyword mapping still route via fallback chain (e.g. unknown → `business`).

## Q3: Business sample selection

- `BusinessSample` shape (`content/types.ts:1-10`): `{ name, tagline, description, address, phone, email, heroHeadline, heroSubheadline }` — no `products[]` array. Industry-specific content (menu items, services) lives in category-level `industryBlocks[]` (`content/types.ts:37`) and block builders, not per-business.
- `businesses[]` count per category: need file-by-file confirmation but from `restaurant.ts:6` structure there is an array of samples. Composer throws if `businessIndex` out of range (`template-composer.ts:1220-1222`) so fallback must pick valid index.
- **Recommendation:** fallback picks `businessIndex = seed % content.businesses.length`, using same `seed` param passed to `generateBlocks(prompt, seed)`. Deterministic + safe.
- **Can prompt-extracted name override `biz.name`?** NOT trivially. `biz.name` is wired deeply into composed blocks — `logoText` (`:132`, `:293`), feature headlines (`:234`), contact subtext (`:260`), footer copyright (`:296`), gallery alt text (`:388-393`), CTA headline (`:411`), about headline (`:423`), newsletter (`:536`), services (`:756`), contact hero (`:998`), blog hero (`:1035`). A shallow post-compose `.name` substitution would miss interpolated strings.
- **Options:**
  1. **Pre-compose override (clean)**: before calling `composeTemplate`, clone the selected `biz` and set `biz.name = promptName, biz.tagline = promptName ? biz.tagline : biz.tagline`. But composer reads `biz` via `getCategoryContent()` → mutating that cached object pollutes future calls. Must deep-clone first.
  2. **Post-compose string replace**: walk composed blocks, replace all occurrences of original `biz.name` substring with prompt name. Works because `biz.name` is always the same known literal. Simpler but fragile if original name appears inside other fields coincidentally.
  3. **Add `overrideName?` param to `composeTemplate`**: cleanest long-term but modifies composer signature.

Recommend option 1 (deep-clone + override `biz.name` and `biz.tagline` before compose) — no composer changes, no walker.

## Q4: Theme preset selection

`ThemePreset` shape at `theme-presets.ts:4-14`:
```
{ name, primaryColor, secondaryColor, accentColor, fontPairingId, colorMode, spacingPreset, borderRadius, shadowPreset }
```
Each category has 5 presets (e.g. `RESTAURANT_PRESETS` at `:17-23`, `ECOMMERCE_PRESETS` at `:26-32`, etc.) — 14 categories × 5 = 70 total presets.

Generator theme (`generate-blocks.ts:41-47`):
```
{ primaryColor, secondaryColor, fontHeading, fontBody, colorMode }
```

**Shape diff:**
| ThemePreset field | Generator theme | Action |
|---|---|---|
| `primaryColor` | `primaryColor` | direct |
| `secondaryColor` | `secondaryColor` | direct |
| `accentColor` | — | dropped (or map to tertiary if added later) |
| `fontPairingId` | `fontHeading` + `fontBody` | **CRITICAL: need resolver table.** Example pairings seen: `warm-friendly`, `modern-clean`, `elegant-serif`, `luxury-brand`, `pro-corporate`, `bold-impact`, `tech-forward`, `startup-vibe`, `minimal-swiss`, `geometric`, `fresh-rounded`, `humanist`, `cafe-bistro`, `artisan`, `editorial`, `futuristic`, `creative-studio`, `retro-modern`, `bold-geometric` (~20 ids). Need to find the pairing lookup file. |
| `colorMode` | `colorMode` | direct |
| `spacingPreset`, `borderRadius`, `shadowPreset` | — | dropped |

**Preset selection for fallback:**
1. Prompt → category (Q2 translator).
2. Load `{CATEGORY}_PRESETS` (e.g. import from `theme-presets.ts`).
3. Pick via `seed % presets.length` — matches current generator's `THEME_PALETTES` style selector.
4. Optionally bias by `parseIntent().style` (`modern | classic | minimal | bold`) → match preset name keywords: `minimal`→preset with `Minimal` in name, `bold`→`Bold/Neon`, `classic`→`Elegant/Heritage`, `modern`→default.

Composer theme is NOT backward-compatible with generator theme without the `fontPairingId` resolver. This is the biggest adapter risk — flagged below.

## Q5: Multi-page extraction

From `composeTemplate` (`template-composer.ts:1224-1239`):
- `pages[0]` = home (pushed first at `:1228` via `buildHomePage`).
- `pages[1]` = about (variant ≥ professional, `:1232`).
- `pages[2]` = contact (`:1233`).
- `pages[3]` = services (variant = premium, `:1237`).
- `pages[4]` = blog (`:1238`).

**Home is always at index 0.** Safe.

**Cross-page references:** composer builds links per page via `pageNames` passed into builders (`:1224`, `:1228`). Navigation block (`buildNavigation` `:124-136`) and footer copy pages[] as internal links. If fallback drops all non-home pages but keeps navigation/footer unchanged, the nav will point to `/about`, `/contact` that don't exist.

**Options for fallback:**
1. Keep `variant: 'starter'` — composer only builds home page (no about/contact/services/blog, see conditionals `:1231`, `:1236`). But nav/footer inside home page still reference `pages[]` list from `getPageNames('starter')`. Need to confirm starter's page list — likely just `['/']`.
2. Keep all pages: return multi-page `GenerationResult.pages[]` — generator already supports `pages?` field (`generate-blocks.ts:38`). Check whether downstream (openai-generator caller) actually consumes `pages[]`.

**Recommendation:** use `variant: 'starter'` to get single-page output cleanly, avoiding dangling nav links. Falls back to 1-page site matching current `generateBlocks` behavior. If multi-page is desired, use `professional` and return `pages[]` in adapter.

## Unresolved questions

1. **Font pairing resolver table location unknown.** `fontPairingId` strings (e.g. `warm-friendly`) are referenced in `theme-presets.ts` but resolved to concrete Google Font names somewhere else. Researcher 02 must find this file (likely `src/lib/ai/font-pairings.ts` or similar) or confirm none exists and we must hardcode.
2. **`businesses[]` count per category** — not verified. Need to confirm each of 14 category files has ≥1 sample and ideally ≥3 for variety. Only `restaurant.ts` structure confirmed.
3. **`getPageNames('starter')` behavior** — does starter return `['/']` only, or still include `/about`, `/contact` for nav links? Affects whether fallback needs to strip nav links or can rely on variant=starter.
4. **Downstream consumer of `GenerationResult.pages[]`** — is it used at all, or only `result.blocks` (home) written to DB? Determines whether multi-page composer output is wasted.
5. **`enforceMinContent` + `applyContentValidation`** are already called inside `composeTemplate` (`:1249-1255`). Fallback adapter must NOT re-apply — would double-process.
6. **`BusinessIntent.style` → ThemePreset mapping** is heuristic; may want Researcher 02 to confirm preset naming convention is stable enough for keyword match.
