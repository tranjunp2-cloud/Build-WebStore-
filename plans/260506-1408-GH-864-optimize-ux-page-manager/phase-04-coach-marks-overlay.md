# Phase 04 — Coach marks overlay (2-step Radix Popover)

**Status:** pending
**Effort:** 2h
**Owns:** `src/components/editor/editor-coach-marks.tsx` (NEW), `src/components/editor/PageManagerPanel.tsx`, `src/components/editor/SettingsPanel.tsx`, `src/app/(editor)/editor/[siteId]/page.tsx`

## Overview

Issue #864 §3: First-time editor visitors see a 2-step coach mark with backdrop + spotlight:
- Step 1 → spotlight on left "Page Library" column → "Bước 1: Tạo trang tại đây"
- Step 2 → spotlight on right "Menu Settings" panel → "Bước 2: Quản lý hiển thị menu tại đây"

Uses Radix `@radix-ui/react-popover` (already installed) — no third-party tour libs.

## Files to create

- `src/components/editor/editor-coach-marks.tsx` (~150 LoC, file-size cap obeyed)

## Files to modify

- `src/components/editor/PageManagerPanel.tsx` — add `data-coach="page-library"` on root container
- `src/components/editor/SettingsPanel.tsx` — add `data-coach="menu-settings"` on the `menu` tab content (or tab button if more reliable)
- `src/app/(editor)/editor/[siteId]/page.tsx` — mount `<EditorCoachMarks />`, expose `setActiveTab` to switch right panel to menu on step 2

## Files to read for context

- `src/components/editor/AIChatPanel.tsx:95` (existing localStorage pattern in editor)
- `src/components/ui/popover.tsx` (shadcn wrapper)
- `src/components/editor/SettingsPanel.tsx:1144,1182,1251` (active tab handling — `'menu'` tab id)

## Implementation steps

### 1. Create `src/components/editor/editor-coach-marks.tsx`

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { useI18n } from '@/i18n'

const STORAGE_KEY = 'editor:coach-marks:v1:seen'

interface Props {
    /** Called when user enters step 2 — parent should switch right panel to menu tab */
    onEnterStep2?: () => void
    /** Called on dismissal — parent restores any state changed for step 2 */
    onDismiss?: () => void
    /** Defer mount until editor layout settles. Default 300ms. */
    mountDelayMs?: number
}

type Step = 0 | 1 | 2  // 0 = not started, 1/2 = active

export function EditorCoachMarks({ onEnterStep2, onDismiss, mountDelayMs = 300 }: Props) {
    const { t } = useI18n()
    const cm = t.editor.coachMarks
    const [step, setStep] = useState<Step>(0)
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

    // First-mount: check localStorage, schedule delayed start
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (window.localStorage.getItem(STORAGE_KEY) === 'true') return
        const timer = window.setTimeout(() => setStep(1), mountDelayMs)
        return () => window.clearTimeout(timer)
    }, [mountDelayMs])

    // Resolve anchor element when step changes
    useEffect(() => {
        if (step === 0) return setAnchorEl(null)
        const selector = step === 1 ? '[data-coach="page-library"]' : '[data-coach="menu-settings"]'
        const el = document.querySelector<HTMLElement>(selector)
        setAnchorEl(el)
    }, [step])

    const finish = useCallback(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, 'true')
        } catch { /* private mode — non-fatal */ }
        setStep(0)
        onDismiss?.()
    }, [onDismiss])

    const next = useCallback(() => {
        if (step === 1) {
            onEnterStep2?.()
            setStep(2)
        } else {
            finish()
        }
    }, [step, finish, onEnterStep2])

    if (step === 0 || !anchorEl) return null

    const title = step === 1 ? cm.step1Title : cm.step2Title
    const body = step === 1 ? cm.step1Body : cm.step2Body
    const stepLabel = cm.stepLabel.replace('{current}', String(step)).replace('{total}', '2')

    return (
        <>
            {/* Backdrop with cutout — simple overlay, NOT a real spotlight (KISS).
                Use mix-blend or border-ring on anchor instead. */}
            <div
                className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
                aria-hidden="true"
                onClick={finish}
            />

            {/* Spotlight ring — position absolute relative to anchor's bounding rect */}
            <SpotlightRing anchorEl={anchorEl} />

            <Popover.Root open onOpenChange={(o) => { if (!o) finish() }}>
                <Popover.Anchor virtualRef={{ current: anchorEl }} />
                <Popover.Portal>
                    <Popover.Content
                        side={step === 1 ? 'right' : 'left'}
                        sideOffset={12}
                        className="z-[70] w-[320px] rounded-xl border border-white/10 bg-[#1e293b] p-4 shadow-2xl"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                        <p className="text-[11px] uppercase tracking-wide text-cyan-400">{stepLabel}</p>
                        <p className="mt-1 text-sm font-semibold text-white">{title}</p>
                        <p className="mt-2 text-xs leading-relaxed text-gray-300">{body}</p>
                        <div className="mt-4 flex items-center justify-between">
                            <button type="button" onClick={finish} className="text-xs text-gray-400 hover:text-white">
                                {cm.skip}
                            </button>
                            <button type="button" onClick={next} className="rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF] px-3 py-1.5 text-xs font-semibold text-white">
                                {step === 1 ? cm.next : cm.finish}
                            </button>
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </>
    )
}

function SpotlightRing({ anchorEl }: { anchorEl: HTMLElement }) {
    const [rect, setRect] = useState<DOMRect | null>(null)
    useEffect(() => {
        const update = () => setRect(anchorEl.getBoundingClientRect())
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [anchorEl])
    if (!rect) return null
    return (
        <div
            className="pointer-events-none fixed z-[65] rounded-xl ring-2 ring-cyan-400 ring-offset-2 ring-offset-transparent"
            style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
            aria-hidden="true"
        />
    )
}
```

Notes:
- `Popover.Anchor virtualRef` needs Radix ≥ 1.1 (project has `@radix-ui/react-popover ^1.1.15` ✓).
- If virtualRef API differs in installed minor, fallback: render an invisible `<Popover.Trigger />` positioned via portal at `anchorEl`'s rect.
- File ≤200 LoC requirement: ~120 LoC actual.

### 2. Add anchor data attrs

`PageManagerPanel.tsx` root:
```tsx
<div data-coach="page-library" className="relative flex h-full flex-col">
```

`SettingsPanel.tsx` — find the menu tab button (line ~1182) AND the menu tab content (line ~1251). Add `data-coach="menu-settings"` to the rendered `renderMenuContent()` wrapper. If the menu tab isn't active when coach starts, the parent's `onEnterStep2` handler must switch to it first.

### 3. Wire in editor page (`src/app/(editor)/editor/[siteId]/page.tsx`)

```tsx
import { EditorCoachMarks } from '@/components/editor/editor-coach-marks'

// inside component:
const [previousSettingsTab, setPreviousSettingsTab] = useState<SettingsTab | null>(null)

// At end of JSX (alongside EditorMenuDrawer):
<EditorCoachMarks
    onEnterStep2={() => {
        setPreviousSettingsTab(activeSettingsTab)
        setActiveSettingsTab('menu')
    }}
    onDismiss={() => {
        if (previousSettingsTab) setActiveSettingsTab(previousSettingsTab)
        setPreviousSettingsTab(null)
    }}
/>
```

(Bind to whatever the editor's existing settings-tab state is — confirm name during implementation.)

## Acceptance criteria

- [ ] First visit (no localStorage flag): step 1 popover visible after editor loads
- [ ] Click "Tiếp theo" → right panel auto-switches to "Menu" tab → step 2 popover visible
- [ ] Click "Hoàn tất" → both popovers gone, localStorage `editor:coach-marks:v1:seen=true`
- [ ] Reload page → no coach mark
- [ ] "Bỏ qua" works at either step
- [ ] ESC key closes (Radix default)
- [ ] Backdrop click closes
- [ ] No focus trap leaks (don't steal focus from editor inputs)
- [ ] Resize window → spotlight ring follows anchor

## Risk

| Risk | Mitigation |
|------|-----------|
| Anchor not in DOM when coach starts | `mountDelayMs=300` + null-check in render |
| Compact (mobile) layout — right panel hidden | Detect `isCompactLayout` in editor page; skip coach on mobile (or queue both steps on the active visible panel — for simplicity, gate `<EditorCoachMarks />` on `!isCompactLayout`) |
| Popover.Anchor virtualRef API mismatch | Fallback to invisible trigger positioned absolutely (documented inline) |
| User opens editor for the first time on a page with no menu tab visible (e.g. wrong block selected) | `onEnterStep2` switches `activeSettingsTab='menu'`; verify the SettingsPanel always renders menu tab regardless of selected block |
| localStorage unavailable (private mode) | wrapped in try/catch; coach will reappear next visit, acceptable |
| Z-index collision with EditorMenuDrawer (`z-50`) or modals | Coach uses `z-[60]/[65]/[70]` — above drawer, below toasts |
