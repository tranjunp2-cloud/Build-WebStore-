# Phase 3: Builder UI — URL Input + Auto-fill

> Parent: [plan.md](plan.md) | Depends on: [Phase 2](phase-02-ai-extraction-endpoint.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-04-05 |
| Priority | P1 |
| Status | pending |
| Review | pending |
| Effort | ~4h |

## Key Insights

- BusinessInfoForm currently has 4 fields: businessName, industry, shortDescription, products
- Add toggle: "Describe your business" (form) vs "Import from URL" (paste URL)
- After URL extraction, auto-fill the SAME form fields → user reviews → clicks Generate
- Minimal changes to builderStore (add `businessUrl` to BusinessInfo type)
- AIBuilderPageClient.tsx orchestration stays the same

## Requirements

1. Add input mode toggle to BusinessInfoForm: "Manual" | "From URL"
2. URL mode: single URL input + "Extract" button
3. Loading state during extraction (POST /api/ai/extract-from-url)
4. Auto-fill form fields from extraction result
5. User can edit auto-filled fields before generating
6. Show confidence indicator + warnings from extraction
7. Update BusinessInfo type to include optional `businessUrl`

## Architecture

```
BusinessInfoForm
├── [Toggle: Manual | From URL]
│
├── Manual Mode (existing):
│   ├── businessName input
│   ├── industry select
│   ├── shortDescription textarea
│   └── products textarea
│
└── URL Mode (new):
    ├── URL input + "Extract" button
    ├── Loading spinner + progress text
    ├── ↓ On success:
    │   ├── Confidence badge (high/medium/low)
    │   ├── Warnings (if any)
    │   └── Auto-filled form fields (editable!)
    │       ├── businessName (pre-filled)
    │       ├── industry (pre-filled)
    │       ├── shortDescription (pre-filled)
    │       └── products (pre-filled)
    └── ↓ On error:
        └── Error message + "Try manual entry instead" link
```

## Related Code Files

| File | Change |
|------|--------|
| `src/components/builder/BusinessInfoForm.tsx` | Add URL toggle + extraction flow |
| `src/store/builderStore.ts` | Add `businessUrl?: string` to BusinessInfo |
| `src/app/(builder)/builder/new/AIBuilderPageClient.tsx` | No changes needed |

## Implementation Steps

### 1. Update BusinessInfo type in builderStore.ts
```typescript
export type BusinessInfo = {
  businessName: string
  shortDescription: string
  industry: string
  products: string
  language?: 'en' | 'ms' | 'vi' | 'auto'
  businessUrl?: string   // NEW
  source?: 'form' | 'url' // NEW — for analytics
}
```

### 2. Add URL input mode to BusinessInfoForm
- Add state: `inputMode: 'manual' | 'url'`
- Add state: `urlExtracting: boolean`, `extractionResult: ExtractionResult | null`
- Toggle UI: two buttons/tabs at top of form
- URL mode shows single URL input + Extract button

### 3. Implement URL extraction flow
```typescript
async function handleUrlExtract(url: string) {
  setUrlExtracting(true)
  try {
    const res = await fetch('/api/ai/extract-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ url }),
    })
    if (!res.ok) throw new Error(await res.text())
    const data = await res.json()

    // Auto-fill form
    setForm({
      businessName: data.data.businessName || '',
      industry: data.data.industry || '',
      shortDescription: data.data.shortDescription || '',
      products: data.data.products || '',
    })
    setExtractionResult(data.data)
    setInputMode('manual') // Switch to form view so user can review
  } catch (err) {
    toast.error('Could not extract info from URL. Try entering manually.')
  } finally {
    setUrlExtracting(false)
  }
}
```

### 4. UI Components
- Toggle: shadcn/ui `Tabs` component (Manual | From URL)
- URL input: `Input` + `Button` with loading spinner
- Confidence badge: colored badge (green/yellow/red)
- Warnings: small text below badge
- After extraction: switch to Manual view with fields pre-filled + green checkmark

### 5. UX Flow
```
User arrives at /builder/new
  → Sees toggle: [Describe Business] [Import from URL]
  → Clicks "Import from URL"
  → Pastes URL → clicks "Extract"
  → Loading state (1-3 seconds)
  → Form switches to Manual view with fields pre-filled
  → User reviews/edits → clicks "Generate Website"
  → Existing generation flow takes over
```

## Todo

- [ ] Update `BusinessInfo` type in `builderStore.ts`
- [ ] Add `inputMode` state to BusinessInfoForm
- [ ] Add URL input UI (Tabs toggle + input + button)
- [ ] Implement `handleUrlExtract()` fetch call
- [ ] Auto-fill form from extraction result
- [ ] Add confidence badge + warnings display
- [ ] Add loading state during extraction
- [ ] Add error handling + fallback to manual
- [ ] Test responsive layout (mobile)

## Success Criteria

- [ ] Toggle between Manual and URL modes works
- [ ] URL extraction calls API and receives result
- [ ] Form auto-fills with extracted data
- [ ] User can edit auto-filled fields
- [ ] Confidence badge shows correct level
- [ ] Error state shows clear message with manual fallback
- [ ] Mobile responsive
- [ ] Existing Manual mode unchanged (backward compatible)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Extraction takes too long (>5s) | Medium | Medium | Show progress text, allow cancel |
| Auto-fill data is wrong | Medium | Low | User reviews form before generating |
| URL mode confuses users | Low | Medium | Clear labels, progressive disclosure |

## Security Considerations

- URL input sanitized client-side (basic format check)
- Real validation happens server-side (Phase 1 SSRF + Phase 2 safety)
- No raw HTML displayed to user (only extracted text fields)
