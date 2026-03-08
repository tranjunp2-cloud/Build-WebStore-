# Architecture: AI Chat Builder (F-01)
> **Version:** 1.0 | **Created:** 2026-03-08

## Overview

Upgrade existing v1 rule-based builder to Phase 2 with **real OpenAI GPT-4o** integration, **SSE streaming**, and **live preview** using block registry (F-05).

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Builder Page (Client)                      │
│                                                              │
│  ┌─────────────────┐         ┌────────────────────────────┐  │
│  │ BuilderChatPanel │  ───→  │ BuilderPreview (iframe)     │  │
│  │                  │         │  renders blocks via         │  │
│  │ useBuilderStore  │         │  blockRegistry.getComponent │  │
│  │   (Zustand)      │         │                            │  │
│  └────────┬─────────┘         └────────────────────────────┘  │
│           │                                                   │
│           │ POST /api/ai/generate-site (SSE)                  │
└───────────┼───────────────────────────────────────────────────┘
            │
┌───────────▼───────────────────────────────────────────────────┐
│              API Route Handler (Server)                        │
│                                                                │
│  1. Auth check (JWT from cookies)                              │
│  2. Rate limit check (free=1, starter=5, pro=20)               │
│  3. Parse prompt → extract businessName + category             │
│  4. Select theme palette by category                           │
│  5. Build system prompt (block types from registry meta)       │
│  6. Call OpenAI GPT-4o with streaming                          │
│  7. Parse JSON blocks from AI stream                           │
│  8. Validate each block with Zod (blockRegistry.validate)      │
│  9. Save blocks to Payload CMS (Site + Page)                   │
│  10. Stream SSE events back to client                          │
└────────────────────────────────────────────────────────────────┘
```

## SSE Event Protocol

| Event | Payload | Client Action |
|-------|---------|---------------|
| `step` | `{step: string, label: string, progress: number}` | Update progress bar |
| `theme_set` | `{theme: ThemeConfig}` | Apply theme to preview |
| `block_complete` | `{block: BlockConfig, index: number}` | Add block to preview |
| `seo_generated` | `{title: string, description: string}` | Store SEO meta |
| `error` | `{code: string, message: string, retryable: boolean}` | Show toast |
| `done` | `{siteId: string, totalBlocks: number, timeMs: number}` | Show success CTAs |

## Files to Create/Modify

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `app/api/ai/generate-site/route.ts` | Add SSE streaming + OpenAI integration |
| MODIFY | `lib/ai/generate-blocks.ts` | Keep as fallback, add OpenAI generator |
| CREATE | `lib/ai/openai-generator.ts` | OpenAI GPT-4o streaming block generation |
| CREATE | `lib/ai/system-prompt.ts` | AI system prompt builder using registry meta |
| CREATE | `store/builderStore.ts` | Zustand store for builder state |
| MODIFY | `app/(builder)/builder/new/page.tsx` | Upgrade with SSE + live preview + store |

## Key Design Decisions

1. **Keep rule-based fallback**: If OpenAI fails, fall back to existing `generate-blocks.ts`
2. **SSE over WebSocket**: Simpler, works with Next.js API routes, no extra infra
3. **Block-by-block streaming**: Each complete block is streamed + validated individually
4. **Zustand over context**: Better performance, simpler persistence for drafts
