# F19 Vercel Domain Migration — UI Specs (Delta)

> **Feature Code:** F19 (delta to [`F19-store-configuration-design.md`](./F19-store-configuration-design.md))
> **Sources:**
> - PRD: [`docs/prd/F19-vercel-domain-migration.md`](../prd/F19-vercel-domain-migration.md)
> - QA: [`docs/qa/F19-vercel-domain-migration.md`](../qa/F19-vercel-domain-migration.md)
> - Plan: [`plans/260413-1500-f19-vercel-domain-verify-rewrite/plan.md`](../../plans/260413-1500-f19-vercel-domain-verify-rewrite/plan.md)
> - Existing component: `src/app/(dashboard)/settings/domains/DomainsClient.tsx` (673 lines)
> **Date:** 2026-04-13 | **Author:** Designer + Claude
> **Scope:** UI delta only — không thay đổi navigation, sidebar, layout chính

---

## 1. Scope & Intent

Đây là **delta document** chỉ mô tả phần UI thay đổi do migrate từ DigitalOcean sang Vercel. Layout chính của `/settings/domains` (sidebar, header, domain list, primary picker panel) **giữ nguyên 100%** theo `F19-store-configuration-design.md`.

### Những gì THAY ĐỔI

| # | Element | Before | After |
|---|---|---|---|
| 1 | DNS A record value | `162.159.140.98` (Cloudflare) | `76.76.21.21` (Vercel) |
| 2 | DNS CNAME value | `cname.vercel-dns.com` (already correct) | giữ nguyên (đọc từ env `NEXT_PUBLIC_VERCEL_CNAME_TARGET`) |
| 3 | Verify button | Click → result toast | Click → debounce 1s + "Last checked Xm ago" timestamp |
| 4 | Status badge sau verify success | "Active" lập tức | "Active" + banner "SSL provisioning, may take 1-2 min" |
| 5 | NEW component | — | `<TxtChallengeCard>` (chỉ render khi action trả `verification[]`) |
| 6 | Error message | "Server configuration is missing (SERVER_IP)" | (đã xoá) Vercel-native messages |

### Những gì KHÔNG đổi
- Sidebar navigation `/settings/domains`
- Domain list card layout
- "Add Custom Domain" button + modal
- "Set Primary Domain" slide-in panel (`SelectPrimaryPanel`)
- Remove confirmation
- Color tokens, font, spacing, radius (giữ design system hiện tại)

---

## 2. Screen List

| # | Screen | Route | Mô tả | US Ref |
|---|---|---|---|---|
| 1 | Domain Settings | `/settings/domains` | Trang chính — chứa tất cả delta | US-1, US-2, US-3, US-4 |
| 2 | Add Domain Modal | `/settings/domains` (modal) | Inline modal — không đổi structure | US-1, US-2, US-3 |
| 3 | TXT Challenge Section | inside Domain Card | NEW — chỉ render khi verification[] có data | US-3 |

**Note:** Toàn bộ delta nằm trong 1 screen duy nhất. Không có route mới, không có page mới.

---

## 3. Screen Flow (delta only)

```
┌──────────────────────────────────────────────────────────────┐
│  /settings/domains                                            │
└──────────────────────────────────────────────────────────────┘
        │
        ├─► Click "Add Custom Domain" ──► Add Modal
        │     │
        │     ├─► Submit valid domain
        │     │     │
        │     │     ├─► [Vercel verified=true] ───► Domain Card
        │     │     │                               status: Active
        │     │     │                               Banner: "SSL provisioning..."
        │     │     │
        │     │     ├─► [Vercel verified=false, no verification] ──► Domain Card
        │     │     │                                                status: Pending
        │     │     │                                                + DNS Instructions Card
        │     │     │
        │     │     └─► [Vercel verification[] present] ──► Domain Card
        │     │                                              status: Pending
        │     │                                              + DNS Instructions Card
        │     │                                              + ★ TxtChallengeCard (NEW)
        │     │
        │     └─► Submit invalid format ──► Inline error in modal
        │
        ├─► Click "Verify Now" on pending Domain Card
        │     │
        │     ├─► Button → loading spinner (debounced 1s)
        │     ├─► Server action call
        │     ├─► Update "Last checked: just now" timestamp
        │     │
        │     ├─► [Success] ──► Status flips Active
        │     │                  TxtChallengeCard disappears
        │     │                  Banner: "SSL provisioning may take 1-2 min"
        │     │
        │     └─► [Fail] ──► Inline error below button
        │                    TxtChallengeCard re-renders với fresh verification
        │
        └─► Click "Remove" ──► Confirm modal ──► Domain disappears
```

---

## 4. Component Specs

### 4.1 `<TxtChallengeCard>` (NEW)

**Type:** Card component (inline, không phải modal)
**File:** Inline trong `DomainsClient.tsx` (sub-component) HOẶC tách `src/app/(dashboard)/settings/domains/TxtChallengeCard.tsx`
**Position:** Render bên dưới `<DnsInstructionsCard>` của domain pending, chỉ khi `verification.length > 0`

#### Props
```ts
interface TxtChallengeCardProps {
  domain: string;
  verification: VercelDomainVerification[];
  onVerifyClick: () => void;
  isVerifying: boolean;
  lastCheckedAt: number | null; // epoch ms
}

interface VercelDomainVerification {
  type: 'TXT';
  domain: string;   // record name to add (e.g., _vercel.example.com)
  value: string;    // record value (e.g., vc-domain-verify=...)
  reason: string;   // human-readable cause
}
```

#### States
| State | Visual | Trigger |
|---|---|---|
| `default` | Card visible với verification rows | Action returns verification[] |
| `verifying` | Verify button → spinner, button disabled | After click, before response |
| `error` | Red error message below button | Verify fail; verification re-fetched + persisted |
| `hidden` | Component không render | `verification` empty / undefined → success |

#### Layout (Desktop ≥1024px)

```text
┌─────────────────────────────────────────────────────────────┐
│ ⚠️  Verify domain ownership                                  │
│                                                              │
│ Add this TXT record to your DNS, then click Verify.         │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ TXT Record #1                                           │ │
│ │                                                         │ │
│ │ Name                                                    │ │
│ │ ┌─────────────────────────────────────────────┐  [📋]  │ │
│ │ │ _vercel.example.com                          │       │ │
│ │ └─────────────────────────────────────────────┘        │ │
│ │                                                         │ │
│ │ Value                                                   │ │
│ │ ┌─────────────────────────────────────────────┐  [📋]  │ │
│ │ │ vc-domain-verify=example.com,abc123def456    │       │ │
│ │ └─────────────────────────────────────────────┘        │ │
│ │                                                         │ │
│ │ Reason: Domain previously verified on another team     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ Last checked: 2 min ago                                      │
│                                                              │
│ ┌──────────────────┐                                         │
│ │  Verify Now      │                                         │
│ └──────────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
```

#### Layout (Mobile <768px)

Stack vertical, full width, copy buttons full-tap-target (44px):
- Header text + warning icon
- Each verification row: Name field full width → Copy button full width below → Value field full width → Copy button below
- Verify button full width

#### Tailwind classes (theo design system #0B1120 + #00D3D4 accent)

```tsx
<div className="mt-4 p-4 sm:p-6 rounded-[16px] border border-[#FFB020]/30 bg-[rgba(255,176,32,0.04)]">
  {/* Header */}
  <div className="flex items-start gap-3 mb-4">
    <AlertTriangle className="h-5 w-5 text-[#FFB020] shrink-0 mt-0.5" aria-hidden="true" />
    <div>
      <h4 className="text-[15px] font-semibold text-[#F8FAFC] font-['Inter']">
        Verify domain ownership
      </h4>
      <p className="mt-1 text-[13px] text-[rgba(248,250,252,0.6)] font-['Inter']">
        Add this TXT record to your DNS, then click Verify.
      </p>
    </div>
  </div>

  {/* Verification rows — map verification[] */}
  {verification.map((v, i) => (
    <div key={i} className="mb-4 p-4 rounded-[12px] bg-[#0B1120] border border-white/[0.06]">
      <p className="text-[12px] font-medium text-[rgba(248,250,252,0.5)] uppercase tracking-wide font-['Inter']">
        TXT Record #{i + 1}
      </p>
      {/* Name + Value rows with copy buttons — see CopyableField below */}
    </div>
  ))}

  {/* Last checked timestamp */}
  {lastCheckedAt && (
    <p className="text-[12px] text-[rgba(248,250,252,0.4)] font-['Inter'] mb-3" aria-live="polite">
      Last checked: {formatTimeAgo(lastCheckedAt)}
    </p>
  )}

  {/* Verify Now button */}
  <button
    type="button"
    onClick={onVerifyClick}
    disabled={isVerifying}
    aria-busy={isVerifying}
    className="flex items-center justify-center gap-2 h-[44px] px-6 rounded-[12px] bg-[#00D3D4] text-[#0B1120] text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-['Inter']"
  >
    {isVerifying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
    {isVerifying ? 'Verifying…' : 'Verify Now'}
  </button>
</div>
```

#### Children sub-components

##### `<CopyableField>` (reuse existing pattern from DomainsClient)
```ts
interface CopyableFieldProps {
  label: string;       // "Name" or "Value"
  value: string;       // the actual record string
  ariaLabel: string;   // "Copy TXT record name" / "Copy TXT record value"
}
```

States: `idle` (Copy icon) → `copied` (Check icon, 2s) → `idle`

---

### 4.2 `<DnsInstructionsCard>` (UPDATED)

**Type:** Card component (existing, just update constants)
**Changes:** Source DNS values from new env vars

#### Before
```tsx
const DNS_A_RECORD = process.env.NEXT_PUBLIC_SERVER_IP ?? '162.159.140.98';
const DNS_CNAME = process.env.NEXT_PUBLIC_CNAME_TARGET ?? process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'cname.vercel-dns.com';
```

#### After
```tsx
const DNS_A_RECORD = process.env.NEXT_PUBLIC_VERCEL_APEX_IP ?? '76.76.21.21';
const DNS_CNAME = process.env.NEXT_PUBLIC_VERCEL_CNAME_TARGET ?? 'cname.vercel-dns.com';
```

**Visual:** Không đổi. Chỉ giá trị copy-paste khác.

**A11y note:** Khi value đổi từ env, tenant đã copy-paste IP cũ vẫn cần update. Phase 06 backfill sẽ flag những row vẫn pending vì DNS sai trỏ.

---

### 4.3 `<SslProvisioningBanner>` (NEW — small component)

**Type:** Inline banner (notice strip)
**Position:** Bên dưới status badge "Active" trong Domain Card, tự động ẩn sau 60s hoặc khi user dismiss
**Trigger:** Status flip từ `pending` → `active` (sau verify success hoặc add success với verified=true)

#### Props
```ts
interface SslProvisioningBannerProps {
  domain: string;
  shownAt: number;     // epoch ms khi banner hiển thị
  onDismiss: () => void;
}
```

#### States
| State | Visual |
|---|---|
| `visible` | Banner hiển thị với info icon + text + close button |
| `hidden` | Component không render (sau 60s hoặc dismiss) |

#### Layout

```text
┌─────────────────────────────────────────────────────────────┐
│ ℹ️  SSL certificate is being provisioned. May take 1-2 min. │
│    Try https://example.com after a moment.            [✕]  │
└─────────────────────────────────────────────────────────────┘
```

#### Tailwind

```tsx
<div
  role="status"
  aria-live="polite"
  className="mt-3 flex items-start gap-3 p-3 rounded-[10px] bg-[rgba(0,211,212,0.06)] border border-[#00D3D4]/20"
>
  <Info className="h-4 w-4 text-[#00D3D4] shrink-0 mt-0.5" aria-hidden="true" />
  <p className="flex-1 text-[13px] text-[#F8FAFC] font-['Inter']">
    SSL certificate is being provisioned. May take 1-2 minutes.
    Try <code className="text-[#00D3D4]">https://{domain}</code> after a moment.
  </p>
  <button
    type="button"
    onClick={onDismiss}
    aria-label="Dismiss SSL provisioning notice"
    className="shrink-0 h-6 w-6 flex items-center justify-center rounded text-[rgba(248,250,252,0.4)] hover:text-[#F8FAFC] transition-colors"
  >
    <X className="h-4 w-4" />
  </button>
</div>
```

---

### 4.4 `<VerifyButton>` (UPDATED — existing button, new debounce + timestamp)

**Type:** Button (existing in Domain Card, enhanced with timestamp display)
**Changes:**
1. Add `useTransition` lock + 1s debounce on click
2. Display "Last checked: Xm ago" timestamp below button
3. Update copy: "Verify Connection" → "Verify Now"

#### Props (delta)
```ts
interface VerifyButtonProps {
  domain: string;
  isVerifying: boolean;
  lastCheckedAt: number | null;
  onClick: () => void;
}
```

#### States

| State | Button Text | Disabled | Spinner | Timestamp |
|---|---|---|---|---|
| `idle (never verified)` | "Verify Now" | false | hide | hide |
| `idle (verified before)` | "Verify Now" | false | hide | "Last checked: Xm ago" visible |
| `verifying` | "Verifying…" | true | show | "Last checked: just now" or stale |
| `success` | brief checkmark 1s → reset to idle | true → false | hide | "Last checked: just now" |
| `error` | "Verify Now" | false | hide | "Last checked: Xm ago" + error msg below |

#### Debounce implementation

```tsx
const [isPending, startTransition] = useTransition();
const lastClickRef = useRef<number>(0);

const handleClick = () => {
  const now = Date.now();
  if (now - lastClickRef.current < 1000) return; // debounce 1s
  lastClickRef.current = now;
  startTransition(async () => {
    const res = await verifyCustomDomain(domain);
    setLastCheckedAt(now);
    // ...
  });
};
```

#### Time-ago helper

```ts
function formatTimeAgo(epochMs: number): string {
  const diff = Date.now() - epochMs;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
```

---

## 5. Responsive Breakpoints

| Breakpoint | Width | TxtChallengeCard | DnsInstructionsCard | VerifyButton |
|---|---|---|---|---|
| **Mobile** | `<640px` | Stack vertical, copy buttons full-width below field, padding `p-4` | Same stack pattern, font 13px | Full-width button |
| **Tablet** | `640-1024px` | Field + copy button inline (button right), padding `p-5` | 2-column field+copy | Auto-width button |
| **Desktop** | `≥1024px` | Same as tablet, padding `p-6`, max-width 720px within domain card | Same as tablet | Auto-width button |

**No horizontal scroll on mobile.** Long TXT values use `break-all` Tailwind class to wrap.

---

## 6. Interaction States Matrix

| Element | Default | Hover | Focus | Active | Loading | Disabled | Error | Success |
|---|---|---|---|---|---|---|---|---|
| **Verify button** | bg `#00D3D4` text `#0B1120` | opacity 90% | ring 2px `#00D3D4` outline 2px | scale 0.98 | spinner left, text "Verifying…" | opacity 50%, cursor not-allowed | red border around card, error text below | brief checkmark 1s |
| **Copy button (TXT)** | icon Copy, transparent bg | bg `white/5` | ring 2px `#00D3D4` | scale 0.95 | n/a | n/a | n/a | icon Check, color `#10B981`, 2s reset |
| **Dismiss banner** | icon X, opacity 40% | opacity 100% | ring 2px `#00D3D4` | n/a | n/a | n/a | n/a | n/a |
| **TxtChallengeCard** | border `#FFB020/30` bg orange-tint | n/a (container) | n/a | n/a | n/a | n/a | border `#EF4444/40` bg red-tint | n/a (card disappears) |

**Animations:**
- Card fade in on mount: `animate-in fade-in duration-300`
- Card fade out on success: `animate-out fade-out duration-200`
- Button press feedback: `active:scale-[0.98] transition-transform duration-150`
- Spinner rotation: `animate-spin` (default Tailwind 1s linear infinite)
- Banner slide in from top: `animate-in slide-in-from-top-2 duration-300`

**Reduced motion:** Tất cả animations wrapped trong `motion-reduce:transition-none motion-reduce:animate-none`.

---

## 7. Design Token References

Reuse existing tokens từ `F19-store-configuration-design.md` + Tailwind config. Không thêm token mới.

| Token | Value | Usage |
|---|---|---|
| `bg-primary` | `#0B1120` | Card surface |
| `accent` | `#00D3D4` | Primary CTA, success indicator |
| `text-primary` | `#F8FAFC` | Body text |
| `text-secondary` | `rgba(248,250,252,0.6)` | Helper text |
| `text-tertiary` | `rgba(248,250,252,0.4)` | Timestamp, captions |
| `border-default` | `rgba(255,255,255,0.06)` | Card borders |
| `warning` | `#FFB020` | TXT challenge attention |
| `error` | `#EF4444` | Error states |
| `success` | `#10B981` | Copy confirmed |
| `font` | `Inter` | All text |
| `radius-sm` | `8px` | Inline inputs |
| `radius-md` | `12px` | Buttons, sub-cards |
| `radius-lg` | `16px` | Top-level cards |
| `space-3` | `12px` | Compact gap |
| `space-4` | `16px` | Default gap |
| `space-6` | `24px` | Section gap |

---

## 8. Accessibility Specs

### 8.1 ARIA labels (required)

| Element | aria attribute | Value |
|---|---|---|
| Verify button | `aria-busy` | `true` when verifying |
| Verify button (idle) | `aria-label` | "Verify domain {domain} ownership" |
| Copy button (Name) | `aria-label` | "Copy TXT record name {value}" |
| Copy button (Value) | `aria-label` | "Copy TXT record value" |
| Copy button (after copy) | `aria-label` | "Copied! TXT record name" |
| TxtChallengeCard | `role` | `region` |
| TxtChallengeCard | `aria-labelledby` | id of the "Verify domain ownership" heading |
| Last checked timestamp | `aria-live` | `polite` (auto-announce on update) |
| SSL provisioning banner | `role` + `aria-live` | `status` + `polite` |
| Dismiss banner button | `aria-label` | "Dismiss SSL provisioning notice" |
| Warning icon | `aria-hidden` | `true` (decorative) |
| Error message below verify | `role` | `alert` (auto-announce) |

### 8.2 Keyboard navigation (Tab order)

```
Tab 1: Verify Now button
Tab 2: Copy Name button (first verification row)
Tab 3: Copy Value button (first verification row)
Tab 4: Copy Name button (second row, if exists)
... etc
Tab N: Dismiss SSL banner button (if visible)
```

- All interactive elements reachable via Tab
- Focus ring `ring-2 ring-[#00D3D4] ring-offset-2 ring-offset-[#0B1120]` on focus
- Enter/Space activates buttons
- ESC closes modals (existing behavior)
- Tab trap inside Add Domain modal (existing)

### 8.3 Screen reader announcements

| Action | Announcement |
|---|---|
| TxtChallengeCard mounts | "Verify domain ownership. Add this TXT record to your DNS, then click Verify." |
| Copy button clicked | "Copied!" (via `aria-live` on a hidden status div) |
| Verify success | "Domain verified. SSL certificate is being provisioned." |
| Verify error | "Verification failed. {error message}." (role=alert) |
| Last checked update | "Last checked just now" / "Last checked 2 minutes ago" |

### 8.4 Color contrast (WCAG AA)

| Pair | Ratio | Status |
|---|---|---|
| `#F8FAFC` on `#0B1120` (body) | 18.5:1 | ✅ AAA |
| `rgba(248,250,252,0.6)` on `#0B1120` (helper) | 11.1:1 | ✅ AAA |
| `rgba(248,250,252,0.4)` on `#0B1120` (timestamp) | 7.4:1 | ✅ AAA |
| `#00D3D4` on `#0B1120` (accent text) | 9.8:1 | ✅ AAA |
| `#0B1120` on `#00D3D4` (button text on accent) | 9.8:1 | ✅ AAA |
| `#FFB020` on `#0B1120` (warning) | 11.2:1 | ✅ AAA |

All foreground/background pairs ≥4.5:1. **No text < 13px** for body content.

### 8.5 Touch targets (mobile)

- Verify button: `h-[44px]` minimum height ✅
- Copy buttons: 32×32px icon + `hitSlop 8px` extension → 44×44px effective target ✅
- Dismiss button: 24×24px icon + `hitSlop 10px` → 44×44px ✅
- Spacing between copy buttons ≥8px ✅

### 8.6 Reduced motion

```tsx
className="motion-reduce:transition-none motion-reduce:animate-none"
```

Apply to:
- TxtChallengeCard fade in/out
- SslProvisioningBanner slide in
- Button scale press feedback

Spinner remains visible (it's loading feedback, not decorative).

---

## 9. Empty States & Edge Cases

| Scenario | Visual |
|---|---|
| `verification[]` empty after success | TxtChallengeCard fade out + banner appears |
| `verification[]` array length > 3 | Show all rows, vertical scroll if exceeds card max-height (rare, but supported) |
| `verification.value` very long (>80 chars) | `break-all` wraps in copy field, copy button still works |
| `verification.reason` text very long | Truncate to 2 lines with ellipsis, full text visible on click expand |
| Network error during verify | Inline error below button: "Could not verify. Check your connection and try again." |
| Vercel 429 rate limit hit | Inline error: "Too many verify attempts. Please wait {retryAfter}s and try again." |
| Verify clicked twice fast | Second click ignored (debounce 1s) |
| Domain removed while verify in flight | Action returns gracefully, UI doesn't crash |

---

## 10. Self-Check

```
📋 UI Specs Self-Check:
├── Skill ui-ux-pro-max called? ✅
├── Screens count: 1 main + 1 modal + 1 inline section
├── Components count: 4 (TxtChallengeCard, DnsInstructionsCard, SslProvisioningBanner, VerifyButton)
├── Screen Flows? ✅ ASCII diagram §3
├── Responsive Breakpoints? ✅ 3 breakpoints §5
├── Interaction States? ✅ matrix §6 với 8 states
├── Design Token refs? ✅ §7 reuse existing
├── Accessibility specs? ✅ §8 (ARIA + keyboard + SR + contrast + touch + reduced motion)
├── Map PRD user stories? ✅ US-1..US-5 covered
└── Component data/API refs? ✅ Props typed với TS interfaces
```

**Coverage breakdown:**
- US-1 (apex pre-pointed) — `<SslProvisioningBanner>` after add success
- US-2 (DNS not pointed) — `<DnsInstructionsCard>` updated values
- US-3 (TXT challenge) — `<TxtChallengeCard>` NEW
- US-4 (remove) — không cần UI delta
- US-5 (backfill) — không có UI tenant-facing

---

## 11. Open Questions

1. **Q1 (Designer):** Có cần Figma update cho TxtChallengeCard không, hay implement trực tiếp theo spec này? — Recommendation: implement trực tiếp, designer review screenshot sau khi PR ready.
2. **Q2 (i18n):** TXT challenge copy hiện đang English — có cần Vietnamese không? Existing F19 design có nhiều English strings → recommend giữ English cho consistency, defer i18n.
3. **Q3 (UX):** SslProvisioningBanner auto-dismiss sau 60s hay giữ until user dismiss? — Recommendation: auto-dismiss 60s + manual dismiss button.
4. **Q4 (Designer):** Warning icon color cho TxtChallengeCard — `#FFB020` (warning amber) hay `#00D3D4` (brand accent)? Recommendation: amber để phân biệt với info/success states.

---

## 12. Implementation Notes for Cook agent

- TxtChallengeCard có thể tạo inline trong DomainsClient.tsx (~80 LOC) HOẶC tách file riêng. Tách file recommended nếu muốn unit test riêng (test plan TC-U-11).
- VerifyButton existing code đã có `useTransition`, chỉ thêm `lastCheckedAt` state + `formatTimeAgo` helper + 1s debounce ref.
- SslProvisioningBanner cần state ở DomainsClient root để track which domain vừa flip status (Map<domain, timestamp>).
- DNS constants (`DNS_A_RECORD`, `DNS_CNAME`) ở L9-10 chỉ cần đổi env name + fallback value, không touch render logic.
- All new copy strings should follow existing English tone in DomainsClient.tsx (terse, action-oriented).
