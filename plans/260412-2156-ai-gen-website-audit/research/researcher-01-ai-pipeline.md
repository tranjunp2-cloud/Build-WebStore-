# Research: AI Pipeline (OpenAI GPT-4o Path)

## Flow Diagram

```
User fills BusinessInfoForm
    |
POST /api/ai/generate-site (route.ts)
    |
generateSiteWithAI() (openai-generator.ts:28)
    +-- No API key? -> generateWithFallback() -> generateBlocks() [DETERMINISTIC]
    |
buildSystemPrompt() -> 137-line prompt listing all 47 blocks
buildUserPrompt() -> 4-line flat business description
    |
OpenAI GPT-4o API call (temp 0.7, max_tokens 8000, json_object format)
    |
Parse JSON response (truncation repair if needed)
    |
Validate theme (fonts against allowlist)
    |
For each page -> For each block:
    sanitizeBlockData() (lines 232-561)
        +-- Strip string image/upload fields
        +-- VARIANT VALIDATION (lines 255-261) <-- KILLS VARIETY
        |   invalid variant -> meta.defaultVariant || meta.variants[0]
        +-- Normalize nav links, hero buttons, contact fields, footer columns
        +-- EMPTY gallery images (line 523) <-- ALWAYS CLEARS
        +-- EMPTY logo-cloud logos (line 530) <-- ALWAYS CLEARS
    |
    blockRegistry.validate() -> Zod schema (warning only)
    |
Assemble GenerationResult -> Save to Payload CMS
```

## Key Observations

1. **Temperature 0.7** reasonable but insufficient when prompt gives no variety guidance
2. **8000 max_tokens** can truncate full 4-page sites, triggers JSON repair
3. **Sanitization aggressive** — variant fallback collapses all invalid to single default
4. **Gallery/logo-cloud always wiped** — AI generates URLs, Payload expects Media IDs
5. **Zero variant analytics** — no logging of what GPT generates vs what survives

## Variant Availability vs Estimated Usage

| Block Type | # Variants | Default | AI Likely Picks |
|-----------|-----------|---------|----------------|
| hero | 12 | centered | centered |
| features | 8 | grid-3 | grid-3 |
| testimonials | 8 | cards | cards |
| contact | 6 | form | form/split |
| footer | 6 | simple | simple/expanded |
| pricing | 8 | cards | cards |
| gallery | 6 | grid | grid |
| navigation | 6 | simple | simple |
| faq | 3 | accordion | accordion |
| cta | 3 | banner | banner |
| stats | 3 | row | row |

Total available: ~77 variants. Estimated usage: ~14 (one per type).
