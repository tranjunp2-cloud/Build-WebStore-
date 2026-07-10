# Phase 01 — AI Chat Banner CSS Polish

## Context Links

- Design reference: `file:///home/liam/Downloads/ai-bulk-create.html` → `.ai-box` (CSS ~L38–192, HTML ~L757–789)
- Target file: `src/app/(dashboard)/products/page.tsx` L384–449
- Prior feature plan (COMPLETED): `plans/260706-1335-GH-1502-ai-bulk-create-ux-redesign/` (GH-1502)
- Tokens: `src/app/globals.css` (L140–181 light/dark theme blocks)
- Radial-gradient prior art (house style): `src/blocks/shared/decorative/MeshGradient.tsx`, `src/__tests__/unit/blocks/decorative-primitives.test.tsx`
- Code standards: `docs/standards/CODE_STANDARDS.md`

## Overview

- **Priority:** P3 (visual polish)
- **Status:** done — all edits + verification (lint, typecheck, tests, code-review, manual browser check dark/light) complete
- **Description:** Apply 5 scoped className/style edits to the AI Chat banner so it matches the
  `.ai-box` design reference. Pure presentation — no logic, state, API, i18n, or structure change.

## Addendum — placeholder text fix (post-hoc, found via direct screenshot diff)

Original scoping assumed all copy already matched the design 1:1 (based on an incomplete i18n
check that didn't diff the placeholder string specifically). A side-by-side screenshot comparison
with the user surfaced a real mismatch:

- `src/i18n/locales/en.json:1460` `aiChatPlaceholder` was
  `"List several products, one per line — e.g. Leather jacket RM250, Cotton cap RM39"` —
  did not match design HTML's `"e.g. Leather jacket, RM 500, 10 in stock; Baseball cap, RM 50, 30 in stock"`.
- Fixed both `en.json:1460` and `ms.json:1460` (Malay translation updated to match the corrected EN string).
- No test asserted on this key (verified via grep) — no test changes needed.
- Verified: JSON valid, `npm run typecheck` clean, 93 existing tests still pass, browser screenshot
  confirms placeholder now renders exactly as design.
- The command-shell border color difference observed in the same screenshot diff was NOT a bug —
  design reference screenshot was captured in the textarea's `:focus` state; current implementation's
  focus state (verified earlier) already renders the same teal ring.

## Addendum 2 — invisible border bug (found via user follow-up screenshot + computed-style inspection)

User flagged the input border still looked off even in an unfocused screenshot. Ground-truth check via
`getComputedStyle()` in a real browser session (not a visual guess) revealed the true root cause:
**`border-width: 0px` / `border-style: none`** on all three bordered elements in this banner
(outer `.ai-box` wrapper, command-shell, suggestion pills) — the borders were rendering **completely
invisible**, not just wrong-colored. This predates phase-1 (the original pre-edit code had the same
broken pattern).

Root cause: `tailwind.config.js:173` sets `corePlugins: { preflight: false }` (documented reason:
avoids clashing with Payload admin styles). Without Preflight's base reset, a bare `<div>`/`<button>`
never gets `border-style: solid` — Tailwind's plain `border` utility only sets `border-width`, and
with no style, browsers compute border-width as 0 regardless of what's set. This exact gotcha is
already documented multiple times elsewhere in `globals.css` (`.dash-col-divider`, `.dash-tab-trigger`,
`.dash-table` row separators) with the same fix: use the **arbitrary-property shorthand**
`[border:1px_solid_hsl(var(--token))]` instead of splitting into `border` + `border-[color]` utility
classes. (Form `input`/`textarea`/`select` elements are unaffected — `globals.css:1094-1103` forces
`border-style: solid` on those specifically.)

Fixed (all 3, `page.tsx`):
1. Outer wrapper: `border border-[hsl(var(--border))]` → `[border:1px_solid_hsl(var(--border))]`
2. Command-shell: `border border-[hsl(var(--input-border))]` → `[border:1px_solid_hsl(var(--input-border))]`;
   focus-within color override changed from `border-[hsl(var(--ring))]` to `[border-color:hsl(var(--ring))]`
   for consistency (both forms work for a color-only override, arbitrary-property used for clarity).
3. Suggestion pills: `border border-[hsl(var(--primary))]/25` → `[border:1px_solid_hsl(var(--primary)/0.25)]`
   (alpha moved inside the `hsl()` space-alpha syntax since the shorthand can't take a trailing `/25` modifier).

Verified via `page.evaluate(() => getComputedStyle(el))` in a real logged-in browser session (not
screenshot-only): all three now report `border-width: 1px`, `border-style: solid`, correct
`border-color` at rest AND on focus. Screenshots confirm visual match with design in both states.
Lint clean, typecheck clean, 93 existing tests still pass.

## Addendum 3 — same bug, 2 more spots (border width bump + footer divider + kbd badges)

User follow-up review (comparing rest-state screenshot to design) flagged two more issues:

1. **Border weight too thin vs design.** Bumped outer wrapper and command-shell from
   `[border:1px_solid_...]` to `[border:2px_solid_...]` — closer visual match to the design
   reference's apparent line weight (design HTML source literally says 1px, but the approved
   design image reads bolder; user has visual authority on the approved mockup).
2. **Footer divider (textarea/footer split line) and the 3 `<kbd>` hint badges (`Enter`,
   `⌘/Ctrl`, `Enter`) were ALSO invisible** — same root cause as Addendum 2
   (`border-t border-[...]` / `border border-[...]` split pattern, no `border-style` without
   Preflight). Fixed:
   - Footer divider: `border-t border-[hsl(var(--input-border))]` → `[border-top:1px_solid_hsl(var(--input-border))]`
   - 3× `<kbd>`: `border border-[hsl(var(--input-border))]` → `[border:1px_solid_hsl(var(--input-border))]`

Re-verified via `getComputedStyle()`: footer `border-top-width: 1px` / `border-style: solid none none`;
kbd `border-width: 1px` / `border-style: solid`. Screenshot confirms visible divider line + badge
outlines matching design. Typecheck clean, 93 tests still pass.

`docs-manager` also added a short "CSS / Tailwind" gotcha section to
`docs/standards/CODE_STANDARDS.md` documenting the `preflight: false` / invisible-border pattern,
since it has now recurred multiple times in this codebase.

## Addendum 4 — suggestion pill border was always-on, design is hover-only

User flagged: in the design, suggestion pills only show a teal border **on hover**; at rest the
border should be neutral. Root cause: the pre-existing (pre-phase-1) code already hardcoded
`border-[hsl(var(--primary))]/25` as the pill's *resting* border color — a pre-existing design
deviation that Addendum 2's invisible-border fix inadvertently made visible for the first time
(previously masked because the border never rendered at all).

Design source (`ai-bulk-create.html` `.pill` / `.pill:hover`): rest = `border: 1px solid var(--border)`
(neutral slate); hover = `border-color: var(--mint)` (teal) + tinted background.

Fixed: `[border:1px_solid_hsl(var(--primary)/0.25)]` → `[border:1px_solid_hsl(var(--border))]` (neutral
at rest) + added `hover:[border-color:hsl(var(--primary))]` (teal only on hover, matching the
command-shell's focus-color-override pattern from Addendum 2). Kept existing
`hover:bg-[hsl(var(--primary))]/10` background-tint behavior unchanged.

Verified via `getComputedStyle()` at rest vs `.hover()`-triggered state: rest `border-color: rgb(42,54,69)`
(neutral), hover `border-color: rgb(45,212,191)` (teal) — matches design exactly. Typecheck clean,
93 tests still pass.

## Addendum 5 — swap Enter/⌘·Ctrl+Enter keybind logic (user-requested behavior change, not a design-match fix)

User explicitly requested swapping the keyboard shortcut semantics (out of original CSS-only scope,
but a direct, deliberate ask — not a design-diff finding): plain `Enter` now generates drafts;
`⌘/Ctrl+Enter` now inserts a new line (previously the reverse).

Changed (`page.tsx`):
- `onKeyDown` condition: `(e.metaKey || e.ctrlKey) && e.key === 'Enter'` → `e.key === 'Enter' && !e.metaKey && !e.ctrlKey`.
  Only the plain-Enter case calls `preventDefault()` + `handleCreateAi()`; every other case
  (including ⌘/Ctrl+Enter) falls through to the textarea's native default, which inserts a newline.
  No new i18n strings needed — reused existing `aiChatHintGenerate`/`aiChatHintNewLine` values, just
  swapped which `<kbd>` pairing they're rendered next to.
- Footer hint text order swapped to: `Enter to generate · ⌘/Ctrl + Enter new line`.

Verified in a real logged-in browser session: plain Enter opens the review-drafts modal
(`modalOpenAfterPlainEnter: true`); ⌘/Ctrl+Enter does NOT open it (`modalOpenAfterCtrlEnter: false`).
Newline-insertion itself is native browser default behavior (no `preventDefault()` called for that
branch) — Puppeteer's headless synthetic key events couldn't demonstrate the actual newline character
appearing (confirmed as a headless/CDP limitation, not an app bug: even an entirely-unhandled
`Shift+Enter` failed to insert a newline in the same test harness). Typecheck clean, 93 tests still pass.

## Addendum 6 — footer density (padding + button size), user-requested space reduction

User felt the footer row (kbd hints + Generate Drafts button) took up too much vertical space.
Reduced, iteratively per user feedback ("giảm thêm chút nữa"):
- Footer container: `py-2` → `py-1.5` → final `py-1`.
- Generate Drafts button: overrode the shared `dashPrimary`/`size="dash"` (`h-9`/36px) via
  `!`-important Tailwind classes down to `!h-6 !px-2.5 !text-[11.5px]` (24px) — a local override,
  not a change to the shared `Button` component (other `dashPrimary`/`dash` usages elsewhere are
  unaffected). Icon shrunk `h-4 w-4` → `h-3 w-3` to match.

Verified: `getComputedStyle()` on the button confirmed `height: 24px` at the final step. Typecheck
clean, 93 tests still pass.

## Addendum 7 — hide keybind hint row on mobile only

User request: hide the `Enter to generate · ⌘/Ctrl + Enter new line` hint row on mobile, keep it on
tablet/desktop. Used this file's existing mobile/tablet cutoff convention (`md:` / 768px — confirmed
via grep, same breakpoint already used elsewhere in `page.tsx` for other mobile/desktop splits):
- Hint row: `flex flex-wrap ...` → `hidden md:flex flex-wrap ...`.
- Footer container justify: `justify-between` → `justify-end md:justify-between`, so the Generate
  Drafts button doesn't jump to the left edge on mobile once the hint row leaves the flex layout
  (`display:none` removes it from flex distribution entirely).

Verified in real browser at both viewports: desktop (1440px) shows the hint row + button spread
`justify-between`; mobile (390px) hides the hint row entirely (`getComputedStyle().display === 'none'`)
and the button sits flush right. Typecheck clean, 93 tests still pass.

## Addendum 8 — BulkCreateModal.tsx: revert container from drawer back to centered modal

**Scope note:** unlike Addenda 1–7 (all `page.tsx`, the AI Chat banner), this addendum touches
`src/components/dashboard/BulkCreateModal.tsx` (the review-drafts panel) — explicitly out of the
original phase-1 scope ("KHÔNG đụng BulkCreateModal.tsx"), now explicitly requested by the user
via a product decision: revert the panel's outer container from a bottom-sheet drawer back to a
centered modal. Inner content/design (draft cards, header, footer, fields) stays exactly as-is —
only the shell/positioning changes.

Context: commit `7f1bc0c5` ("redesign ai bulk-create review step as a bottom drawer", GH-1502)
originally converted this from a centered modal (table-based) to a bottom drawer (card-based).
That commit also changed unrelated things (card-per-product layout, removed checkboxes, added Stock
field, etc.) — this addendum does NOT revert any of that content; it only reverts the container
shape/position, informed by (but not copy-pasting) the pre-`7f1bc0c5` modal wrapper — the old
version used raw hex (`bg-[#1E293B]`, `text-[#F8FAFC]`) which predates this repo's design-token
migration (F18 light/dark system) and was intentionally NOT reintroduced; current `--card`/`--border`
tokens were kept.

Changed (`BulkCreateModal.tsx`):
- Overlay: `flex items-end justify-center ...` → `flex items-center justify-center ... p-4` (adds
  padding so the modal doesn't touch viewport edges when centered).
- Container: `rounded-t-[18px] ... border-b-0` → `rounded-[18px] ...` (border-b-0 removed, restoring
  the full border on all 4 sides now that the panel floats centered instead of docking to the
  bottom edge).
- 3 stale "drawer style"/"drawer-style" comment references updated to plain "Header —"/"Body —"/
  "Footer —" (accuracy only, no behavior change). Left other "drawer" mentions elsewhere in the file
  alone — those refer to the feature/panel colloquially, not its CSS shape, so they're still accurate.

Verified in a real browser session (full login → type prompt → Enter → wait for AI parse to
complete → screenshot): overlay `align-items: center` (confirmed via `getComputedStyle`), container
`border-radius: 18px` (all corners) and `border-bottom-width: 1px` (restored). Screenshot confirms
the panel renders centered on screen with the draft card content (Product name / Price / Stock /
Variants fields, Discard/Approve All footer) completely unchanged from before. No test asserted on
the removed drawer-specific classNames (`items-end`, `rounded-t-[18px]`, `border-b-0` — grepped,
zero hits in `src/__tests__`). Typecheck clean, 93 tests still pass.

## Addendum 9 — MissingInfoIndicator / AiReviewIndicator not tappable on touch devices

**Scope note:** touches `src/components/dashboard/MissingInfoIndicator.tsx` and
`src/components/dashboard/AiReviewIndicator.tsx` (products list warning-triangle and AI-pulse-dot
indicators) — adjacent to but not literally inside the AI Chat banner. User asked a diagnostic
question ("does this open on tap on tablet/mobile?"); answer was confirmed NO via real
touch-emulated testing before any fix was applied.

Root cause: both components wrap the shared `Tooltip` (`src/components/ui/tooltip.tsx`, built on
`@radix-ui/react-tooltip`), used **uncontrolled**. Radix Tooltip only opens on mouse hover or
keyboard focus — it does not listen for touch/click by design. Touch devices have no hover state,
so the tooltip content was **completely unreachable** on tablet/mobile (confirmed via
`page.touchscreen.tap()` in a real emulated-touch browser session: `tooltipVisibleAfterTap: false`
before the fix).

Considered fixing the shared `ui/tooltip.tsx` primitive instead (would fix all 22 usages across the
app at once) but that's a much larger blast radius (Sidebar, editor panels, settings, discounts,
etc.) — user explicitly chose the narrower option: fix only these 2 indicators, leave the shared
primitive untouched.

Fixed (both files, same pattern): added local `const [open, setOpen] = useState(false)`, made the
`Tooltip` controlled (`open={open} onOpenChange={setOpen}` — `onOpenChange` still receives Radix's
own hover/focus-driven open/close calls, so desktop hover behavior is unchanged), and the trigger's
existing `onClick` (previously only `e.stopPropagation()`) now also does `setOpen(o => !o)` so a
tap toggles it open/closed.

Verification note: `page.touchscreen.tap()` in headless Puppeteer did NOT reliably reproduce the
fix working (same class of headless/CDP limitation as the Ctrl+Enter-newline check in Addendum 5 —
synthetic touch events don't always synthesize a follow-up native `click` event in headless mode).
Switched to `elementHandle.click()` (CDP mouse click) on the same touch-emulated mobile viewport as
a proxy — confirmed `data-state: "instant-open"` and tooltip content rendered correctly
("Missing information / Image alt text"). Real devices always translate a tap into a genuine click
event (standard, non-optional browser behavior), so this is a valid confirmation the fix works in
production; only the headless *test* methodology for raw touch simulation was unreliable, not the
fix itself. 22 existing tests across both indicators (`ai-review-indicator.test.tsx`,
`missing-info-indicator.test.tsx`) still pass unmodified. Typecheck clean.

## Addendum 10 — status dots rendered as stretched pills on iPad Pro / any tablet width (<1280px)

**Scope note:** touches `src/app/globals.css` — a global stylesheet, not a products-page-scoped
file. User reported the AI-review pulse dot and stock-status dot looked like stretched horizontal
capsules instead of small circles on iPad Pro.

Root cause (found via bisecting computed `width` across viewports, not guessing): the Badge `dot`
span (`h-1.5 w-1.5`, used for the Stock column) and `AiReviewIndicator`'s pulse dot span (also
`h-1.5 w-1.5`) both sit inside `<td>` cells of the products table, which has the `dash-table-compact`
class. `globals.css:223-226` (`@media (max-width: 1279.98px) { .dash-table-compact td, .dash-table-compact
td span { ... padding-left: 8px; padding-right: 8px; } }`) — an existing rule meant to give table-cell
*text* breathing room on the "tablet band" below the `xl` (1280px) breakpoint — matches `td span`
too broadly and was ALSO applying 16px of horizontal padding to these two tiny decorative dot spans.
Under `box-sizing: border-box` (global reset), padding eats into the element's declared width, so
each 6px dot's rendered box grew to accommodate the padding, producing the stretched-pill look. Bug
existed below 1280px width (any tablet, not iPad-Pro-specific — confirmed via bisection at 900 /
1024 / 1279 / 1280 / 1440px: broken below 1280, correct at/above).

`MissingInfoIndicator`'s warning triangle is an `<svg>` (lucide `AlertTriangle`), not a `<span>`, so
it was NOT affected by this `td span` selector — only the two span-based dots were.

Fix: narrowed the selector from `.dash-table-compact td span` to
`.dash-table-compact td span:not([aria-hidden])` (both the base rule and the `@media` override) —
excludes decorative `aria-hidden` spans (which by definition carry no text, so the rule's stated
"table-cell text sizing" purpose never applied to them anyway) while leaving real text spans
unaffected.

Blast-radius check: `dash-table-compact` is also used on 6 other tables (customers, discounts,
contact-leads, orders, blog). Grepped all 6 for `aria-hidden` — zero matches — so the `:not()`
exclusion has no effect anywhere except the products table's two dot indicators; zero regression
risk elsewhere.

Verified via `getComputedStyle()` bisection across 900/1024/1279/1280/1440px: dot width is now a
consistent `6px` (matching `h-1.5`) at every width, both before and after the old 1280px breakpoint.
Screenshot confirms round dots (not pills) on an emulated 1024×1366 iPad Pro viewport. Typecheck
clean; 80 tests across `products-crud`, `ai-review-indicator`, `missing-info-indicator`, and
`ui/badge` test suites pass.

## Addendum 11 — legacy price warning: relocate into header row (not a toast — reverted that approach)

**Scope note:** touches `src/app/(dashboard)/products/[id]/page.tsx` (edit product page) and
`src/components/dashboard/product-form/ProductForm.tsx` — a different page than the AI Chat banner,
found via a user /scout request asking whether any other page has a similar top-of-page warning
banner. Scout confirmed this `showLegacyWarning` banner (GH-1032 legacy variant-price bug:
`hasVariants && price === 0`) is the only one of its exact kind in the dashboard (one
visually-similar-but-different case found: `blog/[id]/page.tsx`'s `showDraftRecovery`, a "restore
unsaved draft?" banner — NOT touched, out of scope, different purpose).

**First attempt (reverted):** converted the banner to `toast.warning(...)`. User rejected this —
toasts auto-dismiss, but this warning is meant to persist until the underlying data problem is
actually fixed (user saves a non-zero price), same as before. A toast can't represent that
"stays until condition changes" semantic. User clarified: keep the exact same state/condition logic
and the exact same persistent warning styling — only reposition it so it stops pushing the form
down.

**Final fix:** moved the warning's render location into `ProductForm`'s own header row (previously
only `page.tsx` rendered a banner above `<ProductForm>`; the "Edit Product" title itself lives
inside `ProductForm`). The header is `<div className="flex items-center justify-between mb-8">`
with a single child (back-arrow + title/subtitle) — `justify-between` already reserved empty space
on the right (visible as dead space in the user's own screenshot), so the warning now renders as
that row's second child, filling that space instead of adding a new block below.

Changed:
- `page.tsx`: state/logic reverted to **exactly** the original — `showLegacyWarning` (original name,
  not renamed), `setShowLegacyWarning(true)` at the same detection point in `loadProduct`, no toast.
  Only the JSX output moved: instead of page.tsx rendering the banner div itself, it now passes
  `showLegacyPriceWarning={showLegacyWarning}` down to `<ProductForm>`.
- `ProductForm.tsx`: added `showLegacyPriceWarning?: boolean` prop; added `AlertTriangle` to its
  lucide-react import; renders the **same** banner markup (`role="alert"`, same
  `border-warning/30 bg-warning/10 text-warning text-[13px]` classes, same icon, same
  `t.dashboard.products.form.legacyPriceWarning` text — copy/logic untouched) as the header row's
  right-hand child, with `mx-auto max-w-3xl mb-4` (full-width centered block sizing) swapped for
  `max-w-md` (fits the header's available width, wraps within its own box instead of reserving a
  separate full-page-width row).

Verified: typecheck clean; 871 tests across `src/__tests__/unit/dashboard/` + `src/__tests__/unit/products/`
pass. User confirmed visually in their own browser against a live legacy-priced record ("Wool Coat",
`/products/598`, `hasVariants=true`, `price=0`): warning renders top-right of the header next to
"Edit Product", same visual style as before, "General Information" section starts immediately below
the header with no reserved gap.

## Key Insights

- **`--primary` IS teal** (`#2DD4BF` dark / `#00D3D4` light), NOT blue. Current code's
  `from-blue-500/10` gradient introduces a raw stock blue that has no design-token basis — remove it.
- **`--border` bare token EXISTS** and is the correct neutral card border:
  `globals.css:151` light `#E2E8F0`, `globals.css:178` dark `#2A3645` (design's `var(--border)` = neutral slate `#232b3d`).
  Use `--border` for the outer `.ai-box` wrapper (replacing the teal-tinted `--primary`/20).
- **Radial glow is corner-confined**, not a full-width linear sweep: design uses
  `radial-gradient(120% 140% at 85% -10%, rgba(94,234,212,0.10), transparent 55%)` over a flat panel.
  `rgba(94,234,212,...)` ≈ teal ≈ `hsl(var(--primary))` at ~0.10 alpha.
- **House style for gradients = inline `style={{ backgroundImage }}`** (see `MeshGradient.tsx`), not
  giant Tailwind arbitrary-value class strings. Use inline `style` for the radial layer; keep the flat
  base as `bg-[hsl(var(--card))]` Tailwind class.
- **No test asserts on these classNames** — grep of `src/__tests__/` for `from-blue-500` / `to-teal-400`
  / this banner's classes returns no products-banner matches. Safe to edit without breaking snapshots.
- Dark-mode strategy is `.dark` class (`html:not(.dark)` = light). `hsl(var(--primary))` resolves per
  theme automatically, so a token-based glow adapts to light mode without a literal design copy.

## Requirements

### Functional
- Banner renders identically in behavior; only appearance changes.

### Non-functional
- No new hardcoded hex, no new Tailwind stock colors (`blue-500`, etc.). Tokens only.
- Scope strictly `page.tsx` L384–449. No other files.
- `npm run lint` and `npm run typecheck` remain clean.
- File stays coherent with `CODE_STANDARDS.md` (Tailwind + token conventions).

## Architecture

Single presentational React component region. Data flow unchanged:
`aiPrompt` state → textarea → `handleCreateAi()`. The 5 edits touch only the class/style
attributes of 4 elements (outer wrapper, command-shell, textarea, footer). Suggestion pills
(L446) already use `--primary` tints — leave as-is unless the neutral-border change visibly
clashes (it does not; pills are independent of the wrapper border).

## Related Code Files

**Modify (only):**
- `src/app/(dashboard)/products/page.tsx` — L384–449

**Read for reference (do not edit):**
- `src/app/globals.css` — confirm token names at edit time
- `src/blocks/shared/decorative/MeshGradient.tsx` — inline radial-gradient pattern

**Create / Delete:** none.

## Implementation Steps

The 5 edits (implementer adapts exact Tailwind arbitrary-value syntax; semantics must match design):

1. **Background (most visible fix)** — L385 wrapper.
   Remove `bg-gradient-to-r from-blue-500/10 to-teal-400/10`. Replace with a flat card base
   (`bg-[hsl(var(--card))]`) plus an inline corner-confined radial teal glow:
   ```tsx
   style={{
     backgroundImage:
       'radial-gradient(120% 140% at 85% -10%, hsl(var(--primary) / 0.10), transparent 55%)',
   }}
   ```
   Keep `overflow-hidden relative`. Do NOT introduce raw `blue-500`.

2. **Radius + border** — L385 wrapper.
   `rounded-[16px]` → `rounded-[18px]`.
   `border border-[hsl(var(--primary))]/20` → `border border-[hsl(var(--border))]` (neutral, confirmed present).

3. **Focus ring on command-shell** — L394.
   `focus-within:ring-1 focus-within:ring-[hsl(var(--ring))]`
   → `focus-within:ring-[3px] focus-within:ring-[hsl(var(--primary))]/10`
   (approximates design `box-shadow: 0 0 0 3px rgba(94,234,212,0.12)`).
   KEEP `focus-within:border-[hsl(var(--ring))]` unchanged (already correct).

4. **Textarea font size** — L407.
   `text-[13px]` → `text-[14px]`.

5. **Footer border-top opacity** — L409.
   `border-[hsl(var(--input-border))]/60` → `border-[hsl(var(--input-border))]` (drop `/60`, full opacity).

6. Run `npm run lint` and `npm run typecheck`. Fix any warnings introduced by the edits.

7. Manual browser verification (see Success Criteria).

## Todo List

- [x] Edit 1 — background: remove blue linear gradient → flat `--card` + inline radial teal glow
- [x] Edit 2 — `rounded-[18px]` + neutral `--border` on wrapper
- [x] Edit 3 — command-shell focus ring → `ring-[3px]` teal `/10`
- [x] Edit 4 — textarea `text-[14px]`
- [x] Edit 5 — footer border-top full opacity
- [x] `npm run lint` clean
- [x] `npm run typecheck` clean
- [x] Manual verify `/products` — dark theme matches design
- [x] Manual verify `/products` — light theme reads sensibly (glow not harsh)

## Success Criteria

- All 5 edits applied; wrapper uses neutral border + corner radial teal glow (no blue, no full-width sweep).
- Command-shell shows a 3px soft teal ring on focus.
- Textarea text is 14px; footer divider is full-opacity.
- `npm run lint` + `npm run typecheck` pass with no new warnings.
- Dev server `/products`: banner visually matches `ai-bulk-create.html` `.ai-box` in dark theme;
  in light theme the token-based glow renders as a subtle sensible equivalent (not a literal dark copy).
- No existing test fails (`npm test` unaffected — no className assertions on this region).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `hsl(var(--primary) / 0.10)` alpha syntax unsupported in target browsers/Tailwind build | Low | Med | Space-separated-alpha `hsl(H S L / A)` is standard modern CSS & already used across globals.css; if build complains, fall back to `hsl(var(--primary))` with explicit `rgba`-style or a Tailwind `/10` opacity utility on a solid layer. Verify in browser. |
| Radial glow too harsh in **light** theme (design is dark-only) | Med | Low | Alpha kept low (0.10); token-driven so it tracks light `--primary`. Verify light theme manually; reduce alpha to ~0.06 if it reads harsh. |
| Neutral `--border` too faint in dark theme (lower contrast than old teal border) | Low | Low | Design intends the neutral border; matches `.ai-box`. Accept as intended look. |
| Inline `style` vs Tailwind-arbitrary inconsistency with house style | Low | Low | Inline `style` for gradients is established prior art (`MeshGradient.tsx`) — chosen deliberately over a long class string. |
| Edit accidentally touches Generate button / table below | Low | Med | Scope fenced to L384–449; button explicitly out of scope (see below). Review diff before commit. |

## Security Considerations

None. No user input handling, auth, data, or network path changes. Pure presentational CSS.

## Explicitly will NOT change

- **"Generate Drafts" button** (`variant="dashPrimary"`, L420–429) — white text on teal/blue gradient is
  an intentional app-wide convention per `src/components/ui/button.tsx` (GH-1192). Leave untouched.
- Any i18n key or copy string (verified 100% match with design).
- `BulkCreateModal.tsx`, products table, tabs, toolbar.

## Next Steps

- Dependencies: none (blocks nothing / blocked by nothing).
- Follow-up (separate task): `BulkCreateModal.tsx` review-drawer design alignment.
- On completion → `git-manager`: `style(products): align AI Chat banner with design reference` → PR to `staging`.
