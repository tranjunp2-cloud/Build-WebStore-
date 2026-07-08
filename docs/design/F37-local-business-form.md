# F37 Local Business Form — Wireframe & UI Spec

> **Feature:** US-F37-01 Local Business Data Model
> **Feature Code:** F37
> **Links:**
> - PRD: [`docs/prd/F37-local-seo-search-performance.md`](../prd/F37-local-seo-search-performance.md) §10.2, §13.9
> - Stories: [`docs/stories/F37-local-seo-stories.md`](../stories/F37-local-seo-stories.md) — US-F37-01 (AC-1, AC-2, AC-3)
> - Logic flow: [`docs/design/F37-local-seo-user-flows.html`](F37-local-seo-user-flows.html) — "Luồng 1 — Thiết lập Local Business Data"
> - Implementation plan: [`plans/260703-1757-GH-1309-local-business-data-model/phase-03-editor-ui.md`](../../plans/260703-1757-GH-1309-local-business-data-model/phase-03-editor-ui.md)
> - Pattern source: `src/components/editor/SettingsPanel.tsx` lines 595–650 (`contact` accordion)
> - **HTML demo (static, non-interactive):** [`F37-local-business-form-demo.html`](F37-local-business-form-demo.html) — visual reference for desktop 320px + mobile 375px layouts below; ASCII wireframes in this doc remain source-of-truth (no Figma access for this session)

This is the **first real wireframe** for this screen — until now only a text spec (PRD §10.2) and a Mermaid logic diagram existed, no layout. Screen lives **inside the AI Editor's Site Settings panel** (`SettingsPanel.tsx`, Global tab), NOT a standalone dashboard page.

---

## 1. Placement & Container

- New accordion `localBusiness`, rendered via `renderGlobalAccordion('localBusiness', s.localBusinessInfo, ...)` **directly after** the existing `contact` accordion (after line 650) inside `renderGlobalContent()`.
- Container width: `SETTINGS_PANEL_WIDTH = 320px` on desktop; `fullWidth` prop stretches to host width on tablet compact (F05 Tools sheet) and mobile bottom-sheet.
- Same accordion chrome as every other global section: `globalAccordionButtonCls` (header row, chevron rotates on open) + `globalAccordionBodyCls` (`rounded-b-xl border border-t-0 border-white/[0.08] bg-[var(--editor-surface)] px-4 py-4`).
- Default open state: **open** (`true` in `openGlobalSections`) — **CONFIRMED**, matches `brand`/`contact` convention. Deep-link from Local SEO checklist should still scroll-into-view (mirror the existing `requestedTab.section === 'breadcrumb' | 'footer'` scroll pattern at lines 427–437) even though force-expand is no longer needed — flagged as **net-new wiring**, see §6.

---

## 2. Field Order & Grouping Rationale

Order follows the Mermaid flow (`F37-local-seo-user-flows.html` Luồng 1: A→B→C→D→E→F) exactly — do not reorder, sellers land here from a checklist item and the flow was already validated with PM:

| # | Group | Fields | Why this position |
|---|-------|--------|--------------------|
| 1 | **Address** | streetAddress, city, state (dropdown), postcode, country (fixed) | First — everything downstream (map, categories, hours) is meaningless without a location anchor. Matches `contact` accordion's existing address-last convention being superseded here (BR-02: `localBusiness` replaces free-text `contactInfo.address`, old field kept for backward compat, not shown in this new group). |
| 2 | **Coordinates** | paste-link input → auto lat/lng, advanced manual fallback | Immediately after address because address text alone doesn't geocode reliably; paste-link is the primary path (§13.9), manual lat/lng is a disclosure, not a peer field — keeps the default view short. |
| 3 | **Category & Offer** | businessCategory, priceRange, serviceAreaDescription | Grouped together — all three describe "what kind of business", independent of address/hours, and are peers in the JSON-LD `@type`/`priceRange`/`areaServed` triad. |
| 4 | **Opening Hours** | 7-row Mo–Su table | Last and biggest — deliberately placed after the seller has already committed to lighter fields (momentum principle before the most tedious part of the form). |
| 5 | **Map preview** | read-only iframe | Rendered inline right under the Coordinates group (not at the bottom) — gives immediate visual confirmation the pasted link worked, closing the loop before the seller moves to category/hours. |

---

## 3. Desktop Wireframe (320px panel, default/empty state)

```text
┌ SettingsPanel (320px) ───────────────────────────────────┐
│  ...(brand, contact accordions above)...                  │
└────────────────────────────────────────────────────────────┘

── default state: OPEN (confirmed, matches brand/contact) ────
┌ [▾] Thông tin doanh nghiệp địa phương ────────────────────┐
│                                                             │
│  ĐỊA CHỈ                                                   │
│  Số nhà / Đường                                            │
│  [ 123 Jalan Bukit Bintang                              ]  │
│                                                             │
│  Thành phố / Quận            Mã bưu điện                   │
│  [ Kuala Lumpur          ]   [ 55100        ]              │
│                                                             │
│  Bang / Vùng liên bang                                     │
│  [ Kuala Lumpur / WP Kuala Lumpur          ▾ ]             │
│                                                             │
│  Quốc gia                                                  │
│  [ Malaysia ] (readonly, disabled, grey text)              │
│                                                             │
│  ─────────────────────────────────────────────────────    │
│  VỊ TRÍ (TOẠ ĐỘ)                                           │
│  Dán link Google Maps của bạn                              │
│  [ https://maps.app.goo.gl/xxxxx              ] [Trích ▸]  │
│  ⓘ Dán link chia sẻ từ Google Maps — hệ thống tự lấy toạ độ│
│                                                             │
│  ▸ Nhập toạ độ thủ công (nâng cao)      ← disclosure, closed│
│                                                             │
│  (map preview — hidden, no valid lat/lng yet)              │
│                                                             │
│  ─────────────────────────────────────────────────────    │
│  DANH MỤC & DỊCH VỤ                                        │
│  Danh mục kinh doanh                                       │
│  [ -- Chọn danh mục --                        ▾ ]          │
│      ┄ optgroup: Ăn uống / Bán lẻ / Dịch vụ / Khác         │
│                                                             │
│  Khoảng giá                                                │
│  [ $$  Trung bình                             ▾ ]          │
│                                                             │
│  Khu vực phục vụ                                           │
│  [ VD: Quận 1, Quận 3, TP.HCM                          ]   │
│  [                                                      ]  │
│                                                             │
│  ─────────────────────────────────────────────────────    │
│  GIỜ MỞ CỬA                                                │
│  ┌──────┬─────────┬────────┬────────┐                     │
│  │ Ngày │ Đóng cửa│ Mở lúc │ Đóng lúc│                     │
│  ├──────┼─────────┼────────┼────────┤                     │
│  │ T2   │  [ ]    │[09:00] │[18:00] │                     │
│  │ T3   │  [ ]    │[09:00] │[18:00] │                     │
│  │ T4   │  [ ]    │[09:00] │[18:00] │                     │
│  │ T5   │  [ ]    │[09:00] │[18:00] │                     │
│  │ T6   │  [ ]    │[09:00] │[18:00] │                     │
│  │ T7   │  [✓]    │[--:--] │[--:--] │ ← greyed, disabled   │
│  │ CN   │  [✓]    │[--:--] │[--:--] │ ← greyed, disabled   │
│  └──────┴─────────┴────────┴────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Notes:
- Section sub-headers ("ĐỊA CHỈ", "VỊ TRÍ...", etc.) use the same `text-[11px] font-medium uppercase tracking-wider text-slate-400` label style already used per-field in `contact` — reused here as **group headers** (new usage of an existing style, not a new style).
- `country` renders as a disabled `<Input>` (`disabled` + `text-slate-500` + `cursor-not-allowed`), not a select — there is nothing to choose, but showing it (rather than omitting) reassures the seller the platform captured "Malaysia" for the JSON-LD `addressCountry: "MY"`.
- No dedicated "Save" button inside the accordion — **matches existing pattern**: every field commits via `onBlur → onSiteSettingsChange?.({ localBusiness: {...} })`, which feeds the editor's existing autosave loop; global success toast (`t.editor.toast.saveSuccess`) already fires from `page.tsx:539` on any successful autosave. The AC's "nhấn Save" is satisfied by the ambient autosave, identical to how `contact`/`brand` accordions behave today — no new Save button is being introduced.

---

## 4. State: Coordinates parsed (success confirmation)

```text
│  VỊ TRÍ (TOẠ ĐỘ)                                           │
│  Dán link Google Maps của bạn                              │
│  [ https://maps.app.goo.gl/xxxxx              ] [Trích ▸]  │
│                                                             │
│  ✓ Đã lấy được toạ độ                                      │
│  Latitude   3.146900   (read-only chip)                    │
│  Longitude  101.695500 (read-only chip)                    │
│                                                             │
│  ▸ Nhập toạ độ thủ công (nâng cao)                         │
│                                                             │
│  ┌───────────────────────────────────────────┐             │
│  │                                           │             │
│  │           [ Google Maps iframe ]          │  h-[160px]  │
│  │        output=embed, pin at lat/lng       │             │
│  │                                           │             │
│  └───────────────────────────────────────────┘             │
```

- "✓ Đã lấy được toạ độ" row uses `bg-green-500/15 text-green-300` — **CONFIRMED**, matches the exact in-file precedent at `SettingsPanel.tsx:2416` (social-link "visible/enabled" badge), not `emerald-400` (codebase-wide usage is mixed — 27 files use emerald, 9 use green — but same-file consistency wins over global majority).
- Lat/Lng shown as **read-only chips**, not editable inputs, once parsed via paste-link (regex/redirect layers) — editing them directly is only possible through the manual fallback disclosure below, so the two paths never race each other.
- Map iframe: `<iframe src="https://www.google.com/maps?q={lat},{lng}&output=embed">`, conditional render only when both lat+lng are valid numbers (per phase-03 Key Insights).

### Manual fallback disclosure (3 layers failed)

```text
│  ▾ Nhập toạ độ thủ công (nâng cao)                         │
│    Latitude              Longitude                        │
│    [ 3.1469        ]     [ 101.6955       ]                │
│    ⓘ Dùng khi dán link không tự nhận được toạ độ           │
```

---

## 5. Error States (AC-3)

Inline errors follow the exact precedent at `SettingsPanel.tsx:2500-2525` (phone field): red border on the input (`border-red-500/50`) + `<p className="mt-1 text-[11px] text-red-400">` message below, and a `toast.error()` fired on blur — the field's `onSiteSettingsChange` call is **skipped**, so the bad value never reaches state/save (identical to how `contact.phone`/`contact.email` block on invalid regex today).

```text
│  ▾ Nhập toạ độ thủ công (nâng cao)                         │
│    Latitude              Longitude                        │
│    [ 95           ]▓red   [ 101.6955       ]                │
│    Latitude phải trong khoảng -90 đến 90     ← text-red-400│
```

```text
│  Mã bưu điện                                               │
│  [ 551            ]▓red                                     │
│  Mã bưu điện Malaysia phải có đúng 5 chữ số  ← text-red-400│
```

- Both errors **block the field-level save** (skip `onSiteSettingsChange`) but do **not** block other fields in the same accordion from saving — matches existing per-field onBlur isolation (no form-level submit gate exists today).
- `toast.error(...)` message mirrors existing i18n key convention (`t.editor.settingsValidation.*`) — add `invalidLatitude`, `invalidLongitude`, `invalidPostcode` keys alongside the existing `invalidPhone`.

---

## 6. Opening Hours — isClosed Interaction (AC-2)

```text
Default (open day):
│ T7 │ [ ]  │ [09:00] │ [18:00] │   ← time inputs editable, normal border

Checked "Đóng cửa":
│ T7 │ [✓]  │ [--:--] │ [--:--] │   ← time inputs disabled, text-slate-600,
                                       bg-white/[0.02], cursor-not-allowed
                                       previous opens/closes values retained
                                       in local state (not cleared) so
                                       un-checking restores them
```

- Checking `isClosed` **disables** (not hides) the two time inputs — this preserves layout stability (no row height jump) and matches the PRD's literal spec ("checkbox 'Đóng cửa' + time picker Mở/Đóng" implies the picker stays visible).
- Values are excluded from persisted `openingHours[i]` only when `isClosed: true` at save-time (server strips `opens`/`closes` per Phase 04 JSON-LD emitter, not a UI concern) — UI itself keeps them in local state so a seller who mis-clicks "Đóng cửa" doesn't lose their typed hours on toggle-back.
- Checkbox uses shadcn `<Checkbox>` (`src/components/ui/checkbox.tsx`, already in the codebase but **not yet used anywhere in `SettingsPanel.tsx`** — this is this accordion's first consumer of that primitive in this file).

---

## 7. Mobile Wireframe (375px)

The editor uses two mobile contexts: (a) full-width `fullWidth` Tools-sheet Settings tab, (b) F05 compact `bsBlock` sheet. This accordion only appears in context (a) — global Site Settings, not a per-block sheet.

```text
┌ 375px ───────────────────────────┐
│ [▾] Thông tin doanh nghiệp...    │
│                                   │
│ ĐỊA CHỈ                          │
│ Số nhà / Đường                   │
│ [ 123 Jalan Bukit Bintang     ] │
│                                   │
│ Thành phố / Quận                 │  ← stacks 1-col; the desktop
│ [ Kuala Lumpur              ]   │     "fullWidth && min-[768px]:grid-
│ Mã bưu điện                      │     cols-2" pattern (used for Logo/
│ [ 55100                     ]   │     Favicon, Phone/Email) does NOT
│                                   │     apply below 768px — 375px is
│ Bang / Vùng liên bang             │     always single-column, matching
│ [ Kuala Lumpur / WP KL      ▾]  │     existing contact accordion mobile
│                                   │     behavior exactly.
│ Quốc gia                        │
│ [ Malaysia (disabled)        ] │
│                                   │
│ VỊ TRÍ (TOẠ ĐỘ)                  │
│ Dán link Google Maps của bạn     │
│ [ ...........................] │
│ [        Trích toạ độ         ] │  ← "Trích" button becomes full-width
│                                   │     block button below 768px, not an
│                                   │     inline trailing button (44px
│                                   │     touch-target min, side-by-side
│                                   │     with a text input is too cramped
│                                   │     at 375px)
│                                   │
│ GIỜ MỞ CỬA                       │
│ ┌───────────────────────────┐   │
│ │ T2                        │   │  ← table rows become STACKED CARDS,
│ │ Đóng cửa [ ]              │   │     not a horizontal table — a 4-col
│ │ Mở [09:00]  Đóng [18:00]  │   │     table at 375px would force <60px
│ ├───────────────────────────┤   │     column widths, unreadable + fails
│ │ T3                        │   │     44px touch target min for time
│ │ Đóng cửa [ ]              │   │     inputs. Each day = one compact
│ │ Mở [09:00]  Đóng [18:00]  │   │     card, checkbox + label on row 1,
│ ├───────────────────────────┤   │     two time inputs side-by-side on
│ │ ...T4–CN...               │   │     row 2 (still fits 2-up at 375px).
│ └───────────────────────────┘   │
└───────────────────────────────────┘
```

- This is the one deliberate **layout divergence** from desktop: the opening-hours table becomes a **stacked card list** under 768px, controlled by the same `fullWidth` boolean already threaded through this component (`cn('...', fullWidth && 'min-[768px]:...')`) — reuse the exact responsive-breakpoint convention already established for Logo/Favicon and Phone/Email, just inverted (table → cards instead of 1-col → 2-col).
- Map iframe: full width, `h-[140px]` on mobile vs `h-[160px]` desktop (minor height trim, no other change).
- Minimum touch target 44×44px enforced on: `isClosed` checkbox, time inputs, "Trích toạ độ" button, state `<Select>` trigger.

---

## 8. Reuse vs. Net-New (per phase-03 Key Insights)

| Element | Status |
|---|---|
| Accordion trigger/body chrome, group label style, `onBlur` inline-validation + `toast.error` pattern, disabled/greyed input style, red-400 error text/border | **Reuse** — direct clone of `contact` accordion (lines 595–650) and phone-field error precedent (lines 2500–2525) |
| `<Input>`, `<Textarea>` components, `editorInputClassName`/`editorTextareaClassName` | **Reuse** — same components, same classNames |
| State `<Select>` (shadcn) | **Reuse component**, but **first use in this file** — **CONFIRMED: use shadcn `<Select>` per phase-03 plan** (not the native `<select>` used in `renderThemeContent()`'s font/color pickers). Style must be hand-matched to the surrounding dark editor theme since no in-file shadcn `<Select>` skin exists yet — this accordion establishes it. |
| `<Checkbox>` (shadcn) | **Net-new in this file** — no precedent; first opening-hours row is the first consumer |
| Opening-hours 7-row table (+ mobile stacked-card variant) | **Net-new UI** — no existing table/list pattern in `SettingsPanel.tsx` to clone (confirmed in phase-03 Key Insights) |
| Maps-link paste-and-parse input (+ "✓ Đã lấy được toạ độ" confirmation state, manual disclosure) | **Net-new UI** — no existing precedent; nearest analog is the `LogoEditor`/`FaviconEditor` upload-then-preview pattern (upload → confirm → preview), reused conceptually but not visually |
| Google Maps embed iframe | **Net-new** — no existing map embed anywhere in the editor (`src/blocks/google-maps/` is a storefront block, explicitly NOT reused per phase-03) |
| Deep-link force-expand + scroll-into-view from Local SEO checklist | **Net-new wiring** — conceptually mirrors the existing `requestedTab.section === 'breadcrumb' | 'footer'` scroll-into-view effect (lines 424–443), but that effect currently only knows about `breadcrumb`/`footer`; extending it to `localBusiness` is an implementation task, not yet wired |

---

## 9. Accessibility

- All labels use `<label>` associated via existing `Input`/`Textarea`/`Select` wrapper convention (already accessible in this codebase).
- `isClosed` checkbox needs an explicit `aria-label` per day (e.g. `aria-label="Đóng cửa Thứ 2"`) since the visual label ("T2") is terse — mirror the `aria-label` pattern already used for remove buttons (e.g. `aria-label={`Remove button ${i + 1}`}`).
- Disabled time inputs on closed days must carry `aria-disabled` + not just visual greying, so screen readers announce the disabled state.
- Inline error `<p>` should be associated to its input via `aria-describedby` (not currently done for phone/email precedent either — flagged as a pre-existing gap this new section should not repeat; recommend adding `id`/`aria-describedby` pairing here even though the cloned pattern lacks it).
- Color contrast: `text-red-400` on `bg-[var(--editor-surface)]` (#0F172A dark) and `text-slate-400` labels already meet WCAG AA in the existing dark editor theme (verified informally against other accordions already shipped) — no new contrast risk introduced.

---

## Decisions (confirmed 2026-07-07)

1. **Accordion default state: OPEN** — matches `brand`/`contact` convention. Deep-link scroll-into-view still implemented (§6), just not force-expand (already open).
2. **Copy/wording approved as-is** — "✓ Đã lấy được toạ độ" and the 3-layer-failure message placeholders in this doc are final; no further copy review needed.
3. **Component: shadcn `<Select>`** — confirmed per phase-03 plan, not native `<select>`. This accordion establishes the first shadcn `<Select>` visual precedent in `SettingsPanel.tsx`.
4. **Success color: `bg-green-500/15 text-green-300`** — confirmed to match in-file precedent at `SettingsPanel.tsx:2416`, not `emerald-400`.

**Status:** DONE — ready for Phase 03 implementation, no open design questions remain.
