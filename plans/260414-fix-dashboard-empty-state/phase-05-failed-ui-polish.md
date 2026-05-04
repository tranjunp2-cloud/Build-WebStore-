# Phase 05: Polish Failed State UI — Softer Tone + 2 CTAs

> Parent: [plan.md](plan.md) | Depends on: [Phase 03](phase-03-dashboard-logic.md)

## Overview

- **Priority:** P1
- **Status:** pending
- **Effort:** 30m

## Context

Hiện tại `DashboardGenerationFailed` dùng tone **orange/warning** quá mạnh — gây cảm giác nghiêm trọng cho user. Cần đổi sang tone nhẹ nhàng hơn, đồng thời thêm 2 CTA rõ ràng thay vì 1 nút "Try Again" chung chung.

## Requirements

1. **Tone nhẹ nhàng hơn** — không dùng màu orange warning, chuyển sang tone neutral/blue nhẹ nhàng (giống empty state hiện tại với teal/blue)
2. **2 CTAs:**
   - Primary: "Try again with AI" → `/builder/new`
   - Secondary: "Choose a template" → `/templates`
3. **Icon:** đổi từ warning triangle sang icon nhẹ nhàng hơn (refresh/retry hoặc giữ rocket nhưng thêm trạng thái)
4. **Sites page:** cập nhật badge + CTA tương ứng

## Related Files

- `src/components/dashboard/DashboardGenerationFailed.tsx` — main component
- `src/app/(dashboard)/sites/page.tsx` — failed site card (badge + actions)
- Reference style: `src/components/dashboard/DashboardEmptyState.tsx` — tone teal/blue

## Implementation Steps

### Step 1: Redesign DashboardGenerationFailed component

**Hiện tại (quá warning):**
- Orange glow, orange icon, orange CTA
- Warning triangle icon
- 1 CTA "Try Again"

**Đề xuất (nhẹ nhàng):**
- Dùng teal glow giống empty state (`#44DDC1/20`)
- Icon: dùng refresh/arrow-path icon thay vì warning triangle
- Heading: "Let's try that again" hoặc "Website creation didn't complete"
- Subtext: "No worries — you can try building with AI or pick from our templates."
- Primary CTA (gradient blue→teal giống empty state): "Try again with AI" → `/builder/new`
- Secondary CTA (outline/ghost style): "Choose a template" → `/templates`

```tsx
export function DashboardGenerationFailed() {
    return (
        <div className="flex w-full flex-col items-center justify-center py-16 md:py-24">
            <div className="flex flex-col items-center justify-center gap-[18px]">
                {/* Icon — soft retry, not warning */}
                <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 bg-[#44DDC1]/20 blur-[60px] rounded-xl" />
                    <div className="relative flex h-[140px] w-[140px] items-center justify-center rounded-full bg-[#44DDC1]/10">
                        <svg className="h-16 w-16 text-[#44DDC1]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                        </svg>
                    </div>
                </div>

                {/* Text */}
                <h2 className="m-0 p-0 text-center text-[30px] font-[800] tracking-[-0.025em] leading-[1.2] text-[#E1E2EB]">
                    Website creation didn't complete
                </h2>
                <div className="m-0 p-0 text-center text-[16px] font-[500] leading-[1.625] text-[#C1C6D7]">
                    No worries — you can try building with AI or pick from our templates.
                </div>

                {/* 2 CTAs */}
                <div className="flex w-full max-w-[447px] flex-col gap-3">
                    <Link
                        href="/builder/new"
                        className="flex w-full no-underline items-center justify-center rounded-[12px] bg-gradient-to-r from-blue-500 to-teal-400 py-[11px] text-[16px] font-semibold text-white shadow-[...] transition-all hover:scale-[1.02]"
                    >
                        Try again with AI
                    </Link>
                    <Link
                        href="/templates"
                        className="flex w-full no-underline items-center justify-center rounded-[12px] border border-white/10 bg-white/5 py-[11px] text-[16px] font-semibold text-[#C1C6D7] transition-all hover:bg-white/10 hover:text-white"
                    >
                        Choose a template
                    </Link>
                </div>
            </div>
        </div>
    )
}
```

### Step 2: Update sites page — softer badge + 2 actions

**Hiện tại:**
- Orange badge "Generation Failed"
- Orange "Try Again" button

**Đề xuất:**
- Badge: đổi sang neutral gray hoặc blue nhẹ: `bg-blue-500/15 text-blue-400 border-blue-500/30` + text "Incomplete"
- 2 actions: "Retry with AI" + "Use Template" (cùng style với normal site actions)
- Card border: bỏ orange, dùng `border-white/10` giống các card khác

## Success Criteria

- [ ] Failed state UI tone nhẹ nhàng, không gây hoảng cho user
- [ ] 2 CTAs rõ ràng: AI retry + template picker
- [ ] Sites page card không nổi bật quá mức so với cards khác
- [ ] Mobile 375px responsive OK
- [ ] Style consistent với DashboardEmptyState (cùng color palette)

## Risk Assessment

- **Low** — chỉ thay đổi UI component, không đụng logic
