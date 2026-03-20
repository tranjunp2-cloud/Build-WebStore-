# Architecture: AI Web Builder (F01)
> **Version:** 1.2 | **Updated:** 2026-03-18

## Overview

Upgrade existing v1 rule-based builder to Phase 2 with **real OpenAI GPT-4o** integration, **Structured Form Input**, **Multilingual Support (EN/BM/VI)**, **Drag-and-Drop Reorder**, and **SSE streaming** for live preview generation.

## 1. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Builder Page (Client)                      │
│                                                              │
│  ┌─────────────────┐         ┌────────────────────────────┐  │
│  │ BuilderFormPanel│  ───→  │ BuilderPreview (iframe)     │  │
│  │ (3 inputs for   │         │ + Drag & Drop Reorder      │  │
│  │  Business info) │         │  renders blocks via         │  │
│  │                 │         │  blockRegistry.getComponent │  │
│  │ useBuilderStore │         │                            │  │
│  │   (Zustand)     │         │                            │  │
│  └────────┬────────┘         └────────────────────────────┘  │
│           │                                                   │
│           │ POST /api/ai/generate-site (SSE Generation)       │
└───────────┼───────────────────────────────────────────────────┘
            │
┌───────────▼───────────────────────────────────────────────────┐
│              API Route Handlers (Server)                       │
│                                                                │
│  Generation Endpoint (/api/ai/generate-site - SSE)             │
│     1. Auth & Rate limit check (free=1, pro=20)                │
│     2. Extract Context (Name, Description, Services)           │
│     3. Detect Language & Build system prompt                   │
│     4. Call OpenAI GPT-4o with streaming                       │
│     5. Parse JSON blocks (4 required: Hero, About, Products, Contact)
│     6. Validate each block with Zod (blockRegistry.validate)   │
│     7. Save blocks to Payload CMS (Site + Page)                │
│     8. Stream SSE events back to client                        │
└────────────────────────────────────────────────────────────────┘
```

## 2. SSE Event Protocol

| Event | Payload | Client Action |
|-------|---------|---------------|
| `step` | `{step: string, label: string, progress: number}` | Update progress bar |
| `theme_set` | `{theme: ThemeConfig}` | Apply theme to preview |
| `block_complete` | `{block: BlockConfig, index: number}` | Add block to preview |
| `seo_generated` | `{title: string, description: string}` | Store SEO meta |
| `error` | `{code: string, message: string, retryable: boolean}` | Show toast |
| `done` | `{siteId: string, slug: string, url: string}` | Show Congratulations Modal |

## 3. Files to Create/Modify

| Action | File / Component | Purpose |
|--------|------------------|---------|
| MODIFY | `app/(builder)/builder/new/page.tsx` | Upgrade with form UI + SSE + store |
| MODIFY | `app/api/ai/generate-site/route.ts` | Process form data, enforce 4 required pages |
| CREATE | `lib/ai/prompts/builder.ts` | System prompt for full site generation |
| MODIFY | `store/builderStore.ts` | Zustand store (add form context, targetLanguage, layout sortOrder) |
| CREATE | `components/builder/DragDropContext.tsx` | Handle drag and drop action in preview |
| CREATE | `components/builder/CongratsModal.tsx` | Post-publish: copy link, redirect to `/admin` |

## 4. Key Design Decisions

1. **Structured Input over Chat**: We replaced the `/api/ai/chat` multi-turn flow with a simple 3-field form panel. This eliminates confusion and guarantees we get the specific business information required to generate a good site.
2. **Multilingual output strategy**: The system prompt injected into the generator will explicitly instruct OpenAI to generate block content in the detected `targetLanguage` from the user's input, with a fallback to English.
3. **Zustand over context**: Better performance, simpler persistence for drafts, and easy to mutate array order for drag-and-drop.
4. **Drag & Drop Reorder**: Modifies the `sortOrder` array in frontend state. Persists via PATCH to Payload CMS only when user clicks "Publish" or "Tinh chỉnh" to avoid excessive DB writes.
5. **No CMS Config in F01**: Builder only redirects to `/admin`, leveraging Payload's existing React-based admin panel.
