# AI Website Generation — Flow Diagrams

> Render trên GitHub, VS Code Mermaid extension, hoặc [mermaid.live](https://mermaid.live)

---

## 1. Flowchart Tổng Quan — 3 Paths

```mermaid
flowchart TD
    subgraph USER["👤 User Input"]
        A["/builder/new — Điền form"] --> B["POST /api/ai/generate-site"]
    end

    subgraph ROUTE["🔐 route.ts — Validation"]
        B --> C["parseRequest() + Zod validate"]
        C --> D["normalizeBusinessInput()"]
        D --> E["getCurrentUser() — JWT auth"]
        E --> F["checkTwoTierRateLimit() — 5/min + 20/hr"]
        F --> G["Resolve tenantId + Smart slug"]
        G --> H["Free tier check — max 1 gen"]
        H --> I["checkBusinessInfoSafety()"]
    end

    I --> J{"Có OPENAI_API_KEY?"}

    subgraph AI_PATH["🤖 AI Path — GPT-4o"]
        J -->|Có| K["resolveComposerCategory() → 14 categories"]
        K --> L["pickCategoryTheme(cat, seed) → ThemePreset"]
        L --> M["buildSystemPrompt(lang, themeContext)"]
        L --> N["buildUserPrompt(info, personality, hint)"]
        M --> O["OpenAI GPT-4o\ntemp: 0.7 | max_tokens: 8000"]
        N --> O
        O --> P{"API thành công?"}
        P -->|Có| Q["Parse JSON + truncation repair"]
        Q --> R["Theme override → preset wins"]
        R --> S["sanitizeBlockData() per block"]
    end

    subgraph SANITIZER["🔍 Sanitizer Pipeline"]
        S --> S1["Strip upload URL strings"]
        S1 --> S2["fuzzyMatchVariant()\nexact → case → alias (40+)"]
        S2 --> S3["pickWeightedVariant()\n14 cat × 14 block types"]
        S3 --> S4["enforceMinContent()\ncarousel≥3, masonry≥4"]
        S4 --> S5["Normalize fields\nnav links, hero buttons, etc."]
    end

    subgraph FALLBACK["⚡ Fallback Path — Rule-Based"]
        J -->|Không| FB1["generateBlocks(prompt, Date.now())"]
        P -->|Fail/Timeout| FB1
        FB1 --> FB2["parseIntent() → name, type, style"]
        FB2 --> FB3["Seeded PRNG\ncreateSeededRandom(seed)"]
        FB3 --> FB4["pickRandom(3 THEME_PALETTES)"]
        FB4 --> FB5["pickRandom(3 CONTENT_VARIATIONS)"]
        FB5 --> FB6["4-6 blocks from MIDDLE_POOL\nshuffle + ordering constraints"]
        FB6 --> FB7["Random variant per block\nfrom VARIANT_OPTIONS"]
    end

    subgraph POST_GEN["📦 Post-Generation"]
        S5 --> PG1["enforceMinimumStructure()\nenforceMinItems()"]
        FB7 --> PG2["GenerationResult"]
        PG1 --> PG2
        PG2 --> PG3["Unsplash pipeline\nplanImageNeeds → fulfillImageNeeds"]
        PG3 --> PG4["URL ContentBrief override\nvisualStyle → theme colors"]
        PG4 --> PG5["Save to Payload CMS\nSite + Pages + blocks[]"]
        PG5 --> PG6["SSE stream → Client\nstep → theme_set → block_complete → done"]
    end

    subgraph TEMPLATE["📋 Template Path — Gallery"]
        T1["GET /api/templates/seed"] --> T2["composeFromBlueprint(preset, seed)"]
        T2 --> T3["getCategoryContent()\n14 categories"]
        T3 --> T4["buildBlockFromSpec()\nper block in blueprint"]
        T4 --> T5{"spec.variant\ndefined?"}
        T5 -->|Có| T6["Use spec.variant"]
        T5 -->|Không| T7["selectVariant()\nsimpleHash(blockType+cat+seed)"]
        T6 --> T8["TemplateSeed → Save CMS"]
        T7 --> T8
    end

    style AI_PATH fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style FALLBACK fill:#3b1f0b,stroke:#f59e0b,color:#fff
    style TEMPLATE fill:#1a2e1a,stroke:#22c55e,color:#fff
    style SANITIZER fill:#2d1b4e,stroke:#a78bfa,color:#fff
    style POST_GEN fill:#1e293b,stroke:#94a3b8,color:#fff
```

---

## 2. Sequence Diagram — Chi Tiết Giao Tiếp Giữa Các Module

```mermaid
sequenceDiagram
    actor User
    participant Route as route.ts
    participant OAIGen as openai-generator.ts
    participant SysPrompt as system-prompt.ts
    participant OpenAI as OpenAI GPT-4o
    participant Sanitizer as sanitizeBlockData()
    participant FallbackGen as generate-blocks.ts
    participant Unsplash as Unsplash Pipeline
    participant CMS as Payload CMS
    participant Client as Client (SSE)

    User->>Route: POST /api/ai/generate-site<br/>{businessInfo, language, contentBrief}

    Note over Route: Auth + Rate Limit + Tenant + Safety

    Route->>Route: parseRequest() + normalizeBusinessInput()
    Route->>Route: getCurrentUser() → JWT verify
    Route->>Route: checkTwoTierRateLimit(5/min, 20/hr)
    Route->>Route: Resolve tenantId + smart slug
    Route->>Route: checkBusinessInfoSafety()

    Route->>OAIGen: generateSiteWithAI(businessInfo, extra, lang, ref)

    Note over OAIGen: Resolve theme BEFORE prompt

    OAIGen->>OAIGen: resolveComposerCategory(prompt) → 14 categories
    OAIGen->>OAIGen: pickCategoryTheme(cat, seed) → ThemePreset

    OAIGen->>SysPrompt: buildSystemPrompt(lang, {preset, category})
    Note over SysPrompt: Block registry (47 blocks)<br/>REQUIRED THEME (exact hex+font)<br/>DESIGN RULES + VARIETY RULES

    OAIGen->>SysPrompt: buildUserPrompt(info, extra, lang, ref)
    Note over SysPrompt: selectPersonality(info) → keyword match<br/>generateCompositionHint(cat) → dynamic

    OAIGen->>OpenAI: chat.completions.create<br/>model: gpt-4o, temp: 0.7, max_tokens: 8000

    alt AI Success
        OpenAI-->>OAIGen: JSON {siteName, category, theme, pages[], seo}

        OAIGen->>OAIGen: Parse JSON (truncation repair if needed)
        OAIGen->>OAIGen: Theme override → preset wins over AI output

        loop Per block in pages
            OAIGen->>Sanitizer: sanitizeBlockData(block, category)
            Note over Sanitizer: 1. Strip upload URLs<br/>2. fuzzyMatchVariant (exact→case→alias)<br/>3. pickWeightedVariant (14cat×14blocks)<br/>4. enforceMinContent (carousel≥3)<br/>5. Normalize fields
            Sanitizer-->>OAIGen: sanitized block
        end

        OAIGen->>OAIGen: enforceMinimumStructure() + enforceMinItems()
        OAIGen-->>Route: GenerationResult {blocks[], pages[], theme, seo}

    else AI Fail (timeout / 429 / error)
        OpenAI-->>OAIGen: Error
        OAIGen->>FallbackGen: generateBlocks(prompt, Date.now())
        Note over FallbackGen: Seeded PRNG<br/>3 palettes × 3 content sets<br/>4-6 middle blocks (shuffle)<br/>Random variants per block
        FallbackGen-->>OAIGen: GenerationResult
        OAIGen-->>Route: GenerationResult (fallback)
    end

    Route->>Unsplash: planImageNeeds(blocks) → fulfillImageNeeds()
    Note over Unsplash: hero bg, gallery, team avatars<br/>about, testimonials → upload to Media

    Route->>Route: URL ContentBrief → override theme colors (if provided)

    Route->>CMS: Create Site + Create Pages (4 pages)<br/>blocks[] saved as JSON

    Route->>Client: SSE events stream
    Note over Client: step:analyzing (10%)<br/>step:generating (20%)<br/>theme_set<br/>block_complete × N<br/>seo_generated<br/>step:saving (95%)<br/>done
```

---

## 3. Component / Dependency Diagram

```mermaid
graph TB
    subgraph ENTRY["🚀 Entry Points"]
        RouteGen["route.ts<br/><i>POST /api/ai/generate-site</i><br/>~350 lines"]
        RouteSeed["seed/route.ts<br/><i>GET /api/templates/seed</i>"]
    end

    subgraph AI_PIPELINE["🤖 AI Pipeline"]
        OAIGen["openai-generator.ts<br/><i>GPT-4o caller + sanitizer</i><br/>~982 lines"]
        SysPrompt["system-prompt.ts<br/><i>Prompt builder + design rules</i><br/>~403 lines"]
        GenBlocks["generate-blocks.ts<br/><i>Rule-based fallback (seeded PRNG)</i><br/>~718 lines"]
    end

    subgraph TEMPLATE_SYSTEM["📋 Template System"]
        Composer["template-composer.ts<br/><i>25 builders, seed variants</i><br/>~1248 lines"]
        Definitions["template-definitions.ts<br/><i>48 old + 56 new presets</i><br/>~220 lines"]
        Content["content/*.ts<br/><i>14 category content files</i>"]
    end

    subgraph INFRA["⚙️ Infrastructure"]
        Registry["block-registry.ts<br/><i>47 blocks, 142 variants, Zod</i><br/>~225 lines"]
        ThemePresets["theme-presets.ts<br/><i>Industry palettes per category</i>"]
        FontPairings["font-pairings.ts<br/><i>Font pairing resolver</i>"]
        ContentSafety["content-safety.ts<br/><i>Input safety filter</i>"]
        UnsplashPipe["unsplash-pipeline.ts<br/><i>Stock image sourcing</i>"]
    end

    subgraph TYPES["📝 Key Types"]
        T1["BusinessInfoInput<br/>{name, industry, products, desc}"]
        T2["GenerationResult<br/>{siteName, blocks[], pages[], theme, seo}"]
        T3["ComposerInput<br/>{category, businessIndex, variant, preset, seed?}"]
        T4["TemplateSeed<br/>{name, category, tier, theme, pages[]}"]
        T5["ThemePreset<br/>{primaryColor, secondaryColor, fontPairingId, colorMode}"]
        T6["BlockSpec<br/>{blockType, variant?, count?, overrides?}"]
    end

    %% Entry → AI Pipeline
    RouteGen -->|generateSiteWithAI| OAIGen
    RouteGen -->|checkBusinessInfoSafety| ContentSafety
    RouteGen -->|planImageNeeds + fulfill| UnsplashPipe

    %% AI Pipeline internal
    OAIGen -->|buildSystemPrompt + buildUserPrompt| SysPrompt
    OAIGen -->|generateWithFallback| GenBlocks
    OAIGen -.->|enforceMinContent| Registry

    %% System prompt deps
    SysPrompt -->|getAllMeta 47 blocks| Registry
    SysPrompt -->|resolveFontPairing| FontPairings
    SysPrompt -.->|ThemePreset injection| ThemePresets

    %% Template system
    RouteSeed -->|composeFromBlueprint| Composer
    Composer -->|getCategoryContent| Content
    Composer -->|TEMPLATE_PRESETS| Definitions
    Composer -->|getBlockMeta, selectVariant| Registry
    Composer -->|enforceMinContent| OAIGen
    Definitions -.->|ThemePreset per template| ThemePresets

    %% Fallback standalone
    GenBlocks -.->|enforceMinContent| OAIGen

    %% Styling
    style AI_PIPELINE fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style TEMPLATE_SYSTEM fill:#1a2e1a,stroke:#22c55e,color:#fff
    style INFRA fill:#2d1b4e,stroke:#a78bfa,color:#fff
    style ENTRY fill:#3b1f0b,stroke:#f59e0b,color:#fff
    style TYPES fill:#1e293b,stroke:#94a3b8,color:#fff
```

---

## 4. Variety System — Layers Diagram

```mermaid
flowchart LR
    subgraph PROMPT["Layer 1: Prompt Engineering"]
        P1["selectPersonality(info)<br/>8 personalities × keywords"]
        P2["generateCompositionHint(cat)<br/>∞ block combinations"]
        P3["DESIGN RULES<br/>hero 5-8w, 60-30-10, AIDA"]
        P4["VARIETY RULES<br/>7 rules, never default-first"]
    end

    subgraph SANITIZER["Layer 2: Sanitizer Guards"]
        S1["fuzzyMatchVariant()<br/>exact → case → alias (40+)"]
        S2["pickWeightedVariant()<br/>14 cat × 14 block types"]
        S3["enforceMinContent()<br/>carousel≥3, masonry≥4"]
        S4["BROKEN_VARIANTS<br/>animated-gradient excluded"]
    end

    subgraph FALLBACK["Layer 3: Fallback PRNG"]
        F1["createSeededRandom(seed)<br/>reproducible random"]
        F2["3 THEME_PALETTES / cat"]
        F3["3 CONTENT_VARIATIONS / cat"]
        F4["MIDDLE_BLOCK_POOL<br/>4-6 from 9, shuffle"]
    end

    subgraph COMPOSER["Layer 4: Template Composer"]
        C1["selectVariant(simpleHash)<br/>seed-based, deterministic"]
        C2["compositionSeed<br/>different per template"]
        C3["enforceBlockOrdering<br/>features→stats, about→team"]
        C4["buildBlockFromSpec<br/>auto-select if undefined"]
    end

    PROMPT -->|AI chọn blocks + variants| SANITIZER
    SANITIZER -->|Validated blocks| OUTPUT["GenerationResult"]
    FALLBACK -->|Khi AI fail| OUTPUT
    COMPOSER -->|Template gallery| OUTPUT

    style PROMPT fill:#1e3a5f,stroke:#60a5fa,color:#fff
    style SANITIZER fill:#2d1b4e,stroke:#a78bfa,color:#fff
    style FALLBACK fill:#3b1f0b,stroke:#f59e0b,color:#fff
    style COMPOSER fill:#1a2e1a,stroke:#22c55e,color:#fff
```

---

## Ghi chú

- **Render:** GitHub tự render Mermaid trong `.md` files. Hoặc dùng VS Code extension "Markdown Preview Mermaid Support".
- **Edit online:** Copy paste vào [mermaid.live](https://mermaid.live) để edit + export PNG/SVG.
- **Pending Phase 06:** Fallback path sẽ đổi từ `generateBlocks()` sang `composeFromBlueprint()` — diagram sẽ cần update.
