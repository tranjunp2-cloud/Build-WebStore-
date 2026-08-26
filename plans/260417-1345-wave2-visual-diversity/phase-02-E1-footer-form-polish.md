# Phase 02 — E1 Footer + Form Polish

## Context
- Parent: [plan.md](plan.md)
- Research: [researcher-02-c1-e1-scope](research/researcher-02-c1-e1-scope.md)

## Overview
- Date: 2026-04-17
- Description: Polish footer 526 LOC (6 variants) inconsistent opacity/gap + audit contact form UX. `/api/contact-submit` endpoint đã có sẵn, scope giảm từ 4-6h → 3-5h.
- Priority: P1
- Implementation status: pending

## Key Insights
- Footer `src/blocks/footer/index.tsx` = **526 lines, 6 variants** (simple/centered-stack/mega-footer/dark-gradient/expanded/minimal).
- **Opacity drift**: tagline 70% (minimal), 40% (dark-gradient), 70% (centered) — inconsistent.
- **Magic numbers**: `0.502`, `0.063`, `0.082` scattered — maintenance burden.
- **Responsive gap**: `mega=gap-6 sm:gap-8`, `expanded/simple=gap-10 fixed` → mobile layout tight.
- **Link title DRY violation**: inline style at L206 vs `<Heading>` at L263.
- Contact form: endpoint `/api/contact-submit` exists, honeypot + validation wired. Chỉ polish UX + a11y.

## Requirements
### Footer
- Extract: `FOOTER_OPACITY_TITLE = 0.9`, `FOOTER_OPACITY_BODY = 0.7`, `FOOTER_OPACITY_CAPTION = 0.5`.
- Replace magic numbers `0.502/0.063/0.082` với named borders/dividers constants.
- Responsive gap consistency: all variants use `gap-6 sm:gap-8 md:gap-10` pattern.
- Create `<FooterSectionTitle>` component — consolidate L206 + L263 inline styles.

### Contact form
- A11y audit: `aria-required`, `aria-invalid`, `aria-describedby` cho all inputs.
- Verify loading spinner visible on button during POST.
- Verify error state rendering nếu endpoint returns 4xx/5xx.
- Phone regex cover: `+60 12-345 6789`, `012-345 6789`, `01 2345 6789`.

## Architecture
**Footer constants top of file**:
```ts
const FOOTER_OPACITY = {
  title: 0.9,
  body: 0.7,
  caption: 0.5,
} as const

const FOOTER_BORDER_OPACITY = 0.082
const FOOTER_DIVIDER_OPACITY = 0.063

const FOOTER_RESPONSIVE_GAP = 'gap-6 sm:gap-8 md:gap-10'

function FooterSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Heading size="sm" className="mb-4 font-semibold" style={{ opacity: FOOTER_OPACITY.title }}>
      {children}
    </Heading>
  )
}
```

**Contact form a11y** — existing inputs get `aria-invalid`, `aria-describedby="field-error"` khi validation fail. Use `useId` for stable IDs.

## Related code files
- `src/blocks/footer/index.tsx` (entire file)
- `src/blocks/contact/index.tsx` (a11y sweep)
- `src/blocks/contact/useContactForm.ts` (if exists — check)
- `src/app/api/contact-submit/route.ts` (verify error paths)

## Implementation Steps

### Footer (2-3h)
1. Extract 3 opacity tokens + 2 border opacity constants + responsive gap const.
2. Replace magic numbers grep-by-grep (expect 8-10 match sites).
3. Create `FooterSectionTitle` inline component.
4. Refactor 6 variant renders to use `FooterSectionTitle` + `FOOTER_RESPONSIVE_GAP`.
5. Visual QA: screenshot 6 variants × 2 BP (desktop + mobile).

### Contact form (1-2h)
1. Audit contact/index.tsx for `aria-*` gaps.
2. Add `aria-invalid` based on validation state; `aria-describedby` pointing to error element.
3. Extract phone regex to `PHONE_PATTERN_MY` constant, widen coverage.
4. Test submission manual: happy path + validation fail + honeypot trigger + 500 error.
5. Unit test: `contact-form.test.tsx` (add if missing).

## Todo list
- [ ] Footer: extract FOOTER_OPACITY + FOOTER_BORDER_OPACITY
- [ ] Footer: replace 8-10 magic-number sites
- [ ] Footer: create FooterSectionTitle component
- [ ] Footer: apply FOOTER_RESPONSIVE_GAP to 6 variants
- [ ] Contact: a11y audit `aria-*` attrs
- [ ] Contact: widen PHONE_PATTERN_MY regex
- [ ] Contact: error state manual test
- [ ] Unit test pass (footer + contact existing suites)
- [ ] Commit: `fix(f01): E1 footer constants + contact form a11y`

## Success Criteria
- 0 magic opacity numbers trong footer (`grep "0\.502|0\.063|0\.082"` = 0 hits outside const declarations).
- Footer all 6 variants use `FOOTER_RESPONSIVE_GAP`.
- `<FooterSectionTitle>` used in ≥ 4 variants.
- Contact form passes a11y axe-core audit (existing test if present).
- TypeScript clean.

## Risk Assessment
- **Risk**: Opacity change `70% → 90%` cho title breaks dark-gradient variant readability. **Mitigation**: per-variant override if needed via prop.
- **Risk**: Contact form phone regex too strict rejects valid intl formats. **Mitigation**: use `libphonenumber-js` or accept any `\d{8,15}` after strip.
- **Risk**: Adding `aria-describedby` without rendering target element = a11y warning. **Mitigation**: render error element with `id` always, hide with CSS when no error.

## Security Considerations
- Contact endpoint `/api/contact-submit` already has honeypot + rate limit (verify in research Q3).
- Phone regex: prevent ReDoS by bounded quantifier.

## Next steps
Phase 03 (A4) and Phase 04 (A5) depend on this shipping stable.
