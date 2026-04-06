# Research: Builder & Onboarding Flow

## Entry Points
1. `/onboarding` — post-signup landing, 3 choices (AI / Template / Scratch)
2. `/builder/new` — AI builder (BusinessInfoForm → SSE generate → completion)
3. `/templates` — standalone gallery page
4. `/editor/[siteId]` — drag-drop editor with template modal inside

## Builder Store (`src/store/builderStore.ts`)
- Steps: `info` → `chat` → `completion`
- Status: idle/streaming/done/error
- Stores: businessInfo, contentBrief, blocks, theme, messages
- Actions: setBusinessInfo, setContentBrief, addBlock, setTheme, reset
- Persistence: localStorage with 24h TTL

## Key Components
```
src/components/builder/
├── BusinessInfoForm.tsx (625 lines) — 4 fields + URL extraction
├── AIBuilderPageClient.tsx — orchestrator (info→chat→gen→complete)
├── BuilderGenerationView.tsx — SSE streaming + progress
├── BuilderCompletionView.tsx — preview + actions
├── BuilderFullPreview.tsx — fullscreen toggle
├── CongratsModal.tsx — post-publish
├── fields/ — form inputs
├── onboarding/ — step flow UI
```

## Template Apply Flow (Current)
```
/templates → TemplateCard click "Use" → POST /api/ai/apply-template
→ Creates site with template blocks/theme → redirect /editor/[siteId]
```
Problem: No AI customization, no business info, raw template copy.

## What's Needed for Template Flow
1. User browses templates → picks one
2. Fills business info (or URL extract) — same as AI builder
3. AI generates site USING template as base (blocks + theme + content structure)
4. Preview → edit → publish

This merges template selection INTO the builder flow instead of separate paths.
