# Architecture: AI Chat Builder (F01)
> **Version:** 1.1 | **Updated:** 2026-03-16

## Overview

Upgrade existing v1 rule-based builder to Phase 2 with **real OpenAI GPT-4o** integration, **Conversational Onboarding**, **Multilingual Support (EN/BM/VI)**, **Drag-and-Drop Reorder**, and **SSE streaming** for live preview generation.

## 1. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Builder Page (Client)                      │
│                                                              │
│  ┌─────────────────┐         ┌────────────────────────────┐  │
│  │ BuilderChatPanel │  ───→  │ BuilderPreview (iframe)     │  │
│  │ (Multi-turn conversational│ │ + Drag & Drop Reorder      │  │
│  │  flow, auto-detect lang)  │ │  renders blocks via         │  │
│  │                           │ │  blockRegistry.getComponent │  │
│  │ useBuilderStore  │         │                            │  │
│  │   (Zustand)      │         │                            │  │
│  └────────┬─────────┘         └────────────────────────────┘  │
│           │                                                   │
│           │ POST /api/ai/chat (Conversational Flow)           │
│           │ POST /api/ai/generate-site (SSE Generation)       │
└───────────┼───────────────────────────────────────────────────┘
            │
┌───────────▼───────────────────────────────────────────────────┐
│              API Route Handlers (Server)                       │
│                                                                │
│  A. Chat Endpoint (/api/ai/chat)                               │
│     1. Detect User Language                                    │
│     2. Extract Info: Business Name, Category, Tone             │
│     3. Return Clarifying Questions (Max 4) or Confirm          │
│                                                                │
│  B. Generation Endpoint (/api/ai/generate-site - SSE)          │
│     1. Auth & Rate limit check (free=1, pro=20)                │
│     2. Build system prompt based on conversational context     │
│        and target language (BM/VI/EN)                          │
│     3. Call OpenAI GPT-4o with streaming                       │
│     4. Parse JSON blocks (4 required: Hero, About, Products, Contact)
│     5. Validate each block with Zod (blockRegistry.validate)   │
│     6. Save blocks to Payload CMS (Site + Page)                │
│     7. Stream SSE events back to client                        │
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
| MODIFY | `app/(builder)/builder/new/page.tsx` | Upgrade with conversational UI + SSE + store |
| CREATE | `app/api/ai/chat/route.ts` | Handles multi-turn conversational onboarding |
| MODIFY | `app/api/ai/generate-site/route.ts` | Add target language param, enforce 4 required pages |
| CREATE | `lib/ai/prompts/conversational.ts` | System prompt for NLU and language detection |
| CREATE | `lib/ai/prompts/builder.ts` | System prompt for full site generation |
| MODIFY | `store/builderStore.ts` | Zustand store (add chat history, targetLanguage, layout sortOrder) |
| CREATE | `components/builder/DragDropContext.tsx` | Handle drag and drop action in preview |
| CREATE | `components/builder/CongratsModal.tsx` | Post-publish: copy link, redirect to `/admin` |

## 4. Key Design Decisions

1. **Decoupled Conversations & Generation**: Use `/api/ai/chat` for lightweight NLU and language detection (GPT-4o-mini is fine here). Use `/api/ai/generate-site` only when confirming the start of site building (requires GPT-4o).
2. **Multilingual output strategy**: The system prompt injected into the generator will explicitly instruct OpenAI to generate block content in the detected `targetLanguage`, with a fallback to English.
3. **Zustand over context**: Better performance, simpler persistence for drafts, and easy to mutate array order for drag-and-drop.
4. **Drag & Drop Reorder**: Modifies the `sortOrder` array in frontend state. Persists via PATCH to Payload CMS only when user clicks "Publish" or "Tinh chỉnh" to avoid excessive DB writes.
5. **No CMS Config in F01**: Builder only redirects to `/admin`, leveraging Payload's existing React-based admin panel.
