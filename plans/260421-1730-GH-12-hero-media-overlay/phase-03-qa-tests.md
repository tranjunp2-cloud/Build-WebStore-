# Phase 03 — QA Doc + Unit Tests

**Status:** completed  
**Depends on:** phase-02 (overlay đã wire vào variants)

## Overview

1. Tạo `docs/qa/F30-hero-media-overlay.md` với TC-IDs cho feature mới
2. Viết unit tests cho `HeroMediaOverlay` và `BlockEditCallbackContext`
3. Verify existing tests không bị break

## Related files

- Create: `docs/qa/F30-hero-media-overlay.md`
- Create: `src/__tests__/unit/blocks/hero-media-overlay.test.tsx`
- Read (gold standard): `src/__tests__/unit/localization/f21-localization.test.tsx` — component + TC-ID pattern

## Step 1 — QA doc

Tạo `docs/qa/F30-hero-media-overlay.md` với TC-IDs:

| TC-ID | Scenario | Expected |
|-------|----------|----------|
| TC-F30-HMO-001 | HeroMediaOverlay ngoài editor (callback = null) | Chỉ render children, không có overlay div |
| TC-F30-HMO-002 | isOwner = false, callback = non-null | Không có overlay (OwnerContext false) |
| TC-F30-HMO-003 | isOwner = true + callback non-null, hover | 3 buttons hiện: Change Image (+ Change Video nếu showVideoButton=true) |
| TC-F30-HMO-004 | Click Change Image → select valid file | compressImage gọi, uploadMediaAction gọi, onFieldChange gọi với URL mới |
| TC-F30-HMO-005 | Click Change Image → invalid file type | toast.error, onFieldChange KHÔNG gọi |
| TC-F30-HMO-006 | uploadMediaAction timeout (>30s) | toast.error('Upload timeout'), onFieldChange KHÔNG gọi |
| TC-F30-HMO-007 | VideoInputPopover mở, nhập URL, click Apply | onFieldChange('videoUrl', url) gọi, popover đóng |
| TC-F30-HMO-008 | VideoInputPopover switch sang Upload tab | file input visible |
| TC-F30-HMO-009 | BlockEditCallbackContext ngoài Provider | useBlockEditCallback() trả null |
| TC-F30-HMO-010 | BlockEditCallbackProvider với value non-null | useBlockEditCallback() trả đúng value |

## Step 2 — Unit test file

File: `src/__tests__/unit/blocks/hero-media-overlay.test.tsx`

Pattern từ gold standard `f21-localization.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HeroMediaOverlay } from '@/blocks/hero/shared'
import { BlockEditCallbackProvider } from '@/components/site-renderer/BlockEditCallbackContext'
import { OwnerProvider } from '@/components/site-renderer/OwnerContext'

// TC-F30-HMO-001, TC-F30-HMO-009
vi.mock('@/app/(dashboard)/actions/media', () => ({
    uploadMediaAction: vi.fn(),
}))
vi.mock('@/lib/media/compress-image', () => ({
    compressImage: vi.fn((file: File) => Promise.resolve(file)),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function renderWithContext(
    ui: React.ReactElement,
    { isOwner = false, callback = null }: { isOwner?: boolean; callback?: { blockIndex: number; onFieldChange: (f: string, v: unknown) => void } | null } = {}
) {
    return render(
        <OwnerProvider value={isOwner}>
            <BlockEditCallbackProvider value={callback}>
                {ui}
            </BlockEditCallbackProvider>
        </OwnerProvider>
    )
}

describe('HeroMediaOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-F30-HMO-001: renders only children when callback is null', () => { ... })
    it('TC-F30-HMO-002: renders only children when isOwner=false', () => { ... })
    it('TC-F30-HMO-003: renders Change Image button when isOwner+callback present', () => { ... })
    it('TC-F30-HMO-004: calls onFieldChange after successful upload', async () => { ... })
    it('TC-F30-HMO-005: shows error toast for invalid file type', () => { ... })
    it('TC-F30-HMO-007: VideoInputPopover URL tab calls onFieldChange', () => { ... })
})

describe('BlockEditCallbackContext', () => {
    it('TC-F30-HMO-009: returns null outside provider', () => { ... })
    it('TC-F30-HMO-010: returns value inside provider', () => { ... })
})
```

**Mock notes:**
- `vi.mock()` top-level only (per testing.md)
- `uploadMediaAction` mock trả `{ url: 'https://cdn.example.com/img.jpg' }`
- `compressImage` mock passthrough (identity)
- `framer-motion` mock nếu cần: `vi.mock('framer-motion', () => ({ motion: { div: 'div', ... }, AnimatePresence: ({ children }) => children }))`

## Step 3 — Verify existing tests

```bash
npm test -- --run src/__tests__/unit/blocks/
```

Expect: tất cả tests pass bao gồm `f30-s2-block-variants.test.ts`.

## Todo

- [ ] Tạo `docs/qa/F30-hero-media-overlay.md` với bảng TC đầy đủ
- [ ] Tạo `src/__tests__/unit/blocks/hero-media-overlay.test.tsx`
- [ ] Implement test cases TC-F30-HMO-001 đến 010
- [ ] Run `npm test -- --run src/__tests__/unit/blocks/hero-media-overlay.test.tsx`
- [ ] Run full test suite: `npm test`
- [ ] Verify 0 regression

## Success criteria

- `docs/qa/F30-hero-media-overlay.md` tồn tại với ≥10 TC-IDs
- Test file pass 100% (no skip, no mock cheat)
- Full test suite pass (kể cả existing f30-s2-block-variants.test.ts)
- Coverage cho HeroMediaOverlay ≥ 70% lines/branches/functions

## Notes cho tester agent

- framer-motion có thể cần mock nếu JSDom không hỗ trợ animations
- `window.matchMedia` cần mock cho VideoHero/SplitVideoHero nếu test toàn bộ variant
- `URL.createObjectURL` cần mock trong JSDom: `vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() })`
