# Researcher 02 — Wave 2 C1 Navigation + E1 Footer/Form audit

**Date**: 2026-04-17 | **Worktree**: `.worktrees/wave2-wix-detailed`

---

## 1. Navigation audit

**File**: `src/blocks/navigation/index.tsx` — **967 lines**

**Variants (6)**:
| Variant | Lines |
|---|---|
| simple | 378-437 |
| transparent | 439-512 |
| sidebar | 514-621 |
| centered | 623-708 |
| mega-menu | 710-857 |
| pill | 859-966 |

**Remaining hardcodes/dead code after 260415 fixes**:
- L214-216: `CTA_GRADIENT_STYLE` dùng magic opacity `0.800`, `0.188` — 3 copies scattered (L263, 606, 909)
- L227: `NavCTAButton` có `motionWrap` prop unused trong Pill/Sidebar (dead code)
- Mọi variant CTA: copy-paste gradient, không reuse constant
- ✓ `useScrollShrink(50)` wired
- ✓ `NavLogo` `gradientMode` shared
- ✓ `color-mix` theme-adaptive done

## 2. C1 Remaining work

`nav-bugfix-followup.md` đã xong 4 lỗi A/B/C/D (CTA URL fallback, default variant removed, NavLogo shared, scroll shrink).

**Polish còn lại (≤30 min — consolidate)**:
- Consolidate 3× `CTA_GRADIENT_STYLE` copies → 1 constant
- Extract magic numbers `0.800` / `0.188` → named consts
- Remove unused `motionWrap` prop OR implement trong Pill/Sidebar

**Scope nhỏ hơn original plan** (4-6h → 1-2h thực tế). C1 gần như DONE, chỉ trim.

## 3. Footer audit

**File**: `src/blocks/footer/index.tsx` — **526 lines**

**Variants (6)**:
| Variant | Lines |
|---|---|
| simple | 501-525 |
| centered-stack | 249-291 |
| mega-footer | 297-359 |
| dark-gradient | 361-408 |
| expanded | 413-460 |
| minimal | 464-496 |

**Visual consistency issues**:
| Issue | Details |
|---|---|
| Opacity scattered | Tagline: 70% (minimal), 40% (dark-gradient), 70% (centered) — non-uniform |
| Hardcoded colors | `0.502, 0.063, 0.082` magic numbers |
| Responsive gap | `mega=gap-6 sm:gap-8`, `expanded/simple=gap-10` fixed → mobile layout tight |
| Link title dup | Heading component vs inline style (L206, L263) — DRY violation |
| Newsletter form | `mega-footer` vs `expanded` call `FooterNewsletterForm` without shared validation |

## 4. Contact form endpoint

**Hook**: `useContactForm` imported at L6 trong `src/blocks/contact/index.tsx`
**Endpoint**: ✓ `src/app/api/contact-submit/route.ts` EXISTS

**Form flow**:
- POST `/api/contact-submit` with validation
- Honeypot `name="website"` implemented
- Per-field validation (email regex, phone pattern)
- Success state: checkmark + message (L187-198)
- Button disabled + spinner during loading (L313)
- Fully wired — **không cần tạo endpoint mới** như plan gốc nói

## 5. E1 scope items

**Footer polish (2-3h)**:
- Extract footer opacity constants (`FOOTER_OPACITY_TITLE/BODY/CAPTION`)
- Remove `0.502 / 0.063 / 0.082` magic → named consts
- Fix responsive gap: `expanded/simple` add `gap-6 sm:gap-8 md:gap-10`
- Consolidate section title → `FooterSectionTitle` component
- Verify newsletter form endpoint consistency (check if separate endpoint)

**Contact form polish (1-2h)** — endpoint exists, chỉ polish:
- Validate phone pattern cover intl formats
- Test honeypot + endpoint error handling (400 vs 500)
- A11y: `aria-required, aria-invalid, aria-describedby`
- Button hover/loading/disabled states verify

**Effort revised**: 3-5h (original 4-6h, giảm vì endpoint có sẵn)

## 6. Unresolved questions

1. `motionWrap` prop in `NavCTAButton` — intentional fallback hay dead code? (C1 quyết)
2. `FooterNewsletterForm` POST endpoint giống `/api/contact-submit` hay riêng? (E1)
3. Contact honeypot endpoint có log spam attempts + rate limit không? (E1)
4. Scroll shrink threshold 50px mobile 6.25% viewport — cần dynamic không? (C1, low prio)
5. `FOOTER_DIVIDER_STYLE` scattered 5 places — consolidate? (E1)
