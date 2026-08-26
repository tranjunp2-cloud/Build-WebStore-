---
title: "AI Builder Pipeline v2 — High-Fidelity URL Generation"
description: "Pass scraped content to generator for ~70% match instead of ~35%"
status: abandoned
priority: P0
effort: 2d
branch: feat/rebuild-user-flow
tags: [ai-builder, pipeline, content-brief, fidelity]
created: 2026-04-05
---

# AI Builder Pipeline v2 — High-Fidelity URL Generation

## Related Docs
- **Current flow diagram**: See session notes above (full ASCII diagram)
- **Competitor analysis**: `reports/competitors/2026-04-05-clicksites-ai.md`
- **Clone repo reference**: `github.com/JCodesMore/ai-website-cloner-template` (analyzed, key learnings applied)

## Problem

URL-generated websites only ~35% similar to source because:
1. Extraction returns only 4 fields → scraped content (headings, features, testimonials) discarded
2. GPT-4o generates NEW content from 4 fields → doesn't use original text
3. No mechanism to pass reference content to generator

## Solution

**ContentBrief** — intermediate type carrying extracted content + style into generator.

```
URL → Scrape → GPT-4o-mini extracts ContentBrief
                    ├── businessInfo (4 fields — existing)
                    ├── referenceContent (hero text, features, testimonials — NEW)
                    └── visualStyle (colors, mood — NEW)
                              ↓
GPT-4o receives: businessInfo + "Use THIS EXACT content from source website"
                              ↓
Website with REAL content from source (~70% match)
```

## Execution Strategy — Sequential (Phase 1 then 3)

| Phase | Description | Status | Effort | Depends |
|-------|-------------|--------|--------|---------|
| [Phase 1](phase-01-content-brief-type.md) | ContentBrief type + URL extractor upgrade | pending | 4h | None |
| [Phase 3](phase-03-enhanced-generator.md) | Enhanced generator — use reference content | pending | 4h | Phase 1 |

**Deferred to v3:**
| Phase | Description | Status |
|-------|-------------|--------|
| [Phase 2](phase-02-vision-extractor.md) | Image/Screenshot extractor (GPT-4o Vision) | deferred |
| [Phase 4](phase-04-ui-multi-input.md) | UI multi-input tabs (URL/Image) | deferred |

## File Ownership

| File | Phase | Action |
|------|-------|--------|
| `src/lib/ai/content-brief.ts` | Phase 1 | NEW — ContentBrief type + helpers |
| `src/lib/ai/url-extraction-prompt.ts` | Phase 1 | MODIFY — extract full content, not just 4 fields |
| `src/app/api/ai/extract-from-url/route.ts` | Phase 1 | MODIFY — return ContentBrief in response |
| `src/lib/validations/ai.ts` | Phase 1 | MODIFY — add ContentBrief Zod schema |
| `src/lib/ai/system-prompt.ts` | Phase 3 | MODIFY — add buildReferencePrompt() |
| `src/lib/ai/openai-generator.ts` | Phase 3 | MODIFY — accept ContentBrief param |
| `src/app/api/ai/generate-site/route.ts` | Phase 3 | MODIFY — wire ContentBrief through |
| `src/components/builder/BusinessInfoForm.tsx` | Phase 3 | MODIFY — pass contentBrief to generation |
| `src/store/builderStore.ts` | Phase 3 | MODIFY — store contentBrief in state |

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Extraction model | GPT-4o-mini (keep) | Content extraction, not creative generation |
| Generator model | GPT-4o (keep) | Creative adaptation of reference content |
| Content passing | `contentBrief` field in request body | Clean, typed, backward compatible |
| Fidelity target | ~70% match | 100% = pixel-perfect clone (not our product) |
| Token budget | referenceContent max 4000 chars | Fit within GPT-4o context alongside system prompt |
