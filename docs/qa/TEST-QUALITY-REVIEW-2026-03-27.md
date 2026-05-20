# Test Quality Review — 27/03/2026

> Review toàn bộ 571 tests (39 files) bởi QA Pro Max skill.

---

## 1. Tổng quan

| Metric | Value |
|--------|-------|
| **Total test files** | 39 |
| **Total tests** | 571 |
| **Average quality** | **3.7 / 5** |
| **Files quality ≥ 4** | 22/39 (56%) |
| **Files quality < 3** | 4/39 (10%) |
| **Exemplary files (5/5)** | 3 (`dashboard-utils.test.ts`, `otp-generate.test.ts`, `builder-store.test.ts`) |

---

## 2. Quality Scores by Category

### Unit Tests (26 files)

| File | Tests | Score | Top Issue |
|------|-------|-------|-----------|
| `dashboard-utils.test.ts` | 32 | ⭐ 5 | None — exemplary |
| `otp-generate.test.ts` | 14 | ⭐ 5 | None — exemplary |
| `builder/builder-store.test.ts` | 26 | ⭐ 5 | None — exemplary |
| `f21-localization.test.tsx` | 22 | ⭐ 5 | Minor: re-implements formatRM locally |
| `dashboard-utils-extended.test.ts` | 27 | 4.5 | Weak hash collision assertion |
| `f19-domains-client.test.tsx` | 12 | 4.5 | Fragile CSS class selector |
| `builder/business-info-form.test.tsx` | 16 | 4.5 | No XSS test on business name |
| `cartStore.test.ts` | 12 | 4.5 | No variant/SKU tests |
| `dashboard-gap-coverage.test.tsx` | 16 | 4 | `global.fetch` mock leaks |
| `f18-cms-layout.test.tsx` | 10 | 4 | Fragile `window.location` mock |
| `editorStore.test.ts` | 10 | 4 | No max history depth test |
| `rate-limit-auth.test.ts` | 8 | 4 | Overlaps with rateLimit.test.ts |
| `rateLimit.test.ts` | 4 | 4 | Duplicates auth rate-limit |
| `stripe-connect.test.ts` | 18 | 4 | Runtime type-shape tests (low value) |
| `checkout.test.ts` | 14 | 4 | Weak SST rounding assertion |
| `editor/preview-frame.test.tsx` | 6 | 4 | Tests CSS class string |
| `editor/settings-panel.test.tsx` | 16 | 4 | Positional combobox selectors |
| `editor/ai-chat-panel.test.tsx` | 12 | 4 | global.fetch not restored |
| `blocks/registry.test.ts` | 11 | 4 | Hardcoded `>=15` block count |
| `VariantsEditor.test.ts` | 4 | 4 | No 3-tier test |
| `f19-staff-directory.test.tsx` | 5 | 4 | Low count for CRUD module |
| `f10-orders.test.tsx` | 6 | 3.5 | No error path for status changes |
| `dashboard-components.test.tsx` | 16 | 3.5 | Mocks component under test |
| `f19-payments-client.test.tsx` | 6 | 3.5 | console.log left in mocks |
| `stores/builderStore.test.ts` | 16 | 4 | **DUPLICATE** of builder/builder-store |
| `email-templates.test.ts` | 18 | 3 | Tests CSS hex colors (coupling) |
| `auth-validation.test.ts` | 21 | 3 | Re-declared schemas (not imported) |
| `content-safety.test.ts` | 3 | 3 | Only 3 tests — dangerously thin |
| `product-dp.test.tsx` | 3 | 3 | Only 3 tests, no 404 path |
| `products-crud.test.tsx` | 18 | 3 | **Tests re-implemented functions** |

### API Tests (7 files)

| File | Tests | Score | Top Issue |
|------|-------|-------|-----------|
| `health.test.ts` | 3 | 4 | Best API test — missing method check |
| `sites.test.ts` | 8 | 3.5 | Only file with 401 test |
| `templates.test.ts` | 7 | 3.5 | No auth tests |
| `ai.test.ts` | 11 | 3 | Auth mocked away entirely |
| `seo.test.ts` | 4 | 3 | Always super-admin role |
| `orders.test.ts` | 3 | 2 | No beforeEach, no IDOR, only POST |
| `products.test.ts` | 2 | 2 | Only 2 tests, no CRUD |

---

## 3. 🔴 Top 10 Critical Issues

### Must fix TRƯỚC release

| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | **Auth mocked away in 6/7 API tests** | `api/*.test.ts` | 401/403 paths untested |
| 2 | **Zero IDOR tests** | All API tests | Multi-tenant data leak risk |
| 3 | **Tests re-implemented functions** | `products-crud.test.tsx:34-55` | False positives — tests own copy, not source |
| 4 | **Re-declared schemas** | `auth-validation.test.ts:17-33` | Schema drift = tests pass while prod breaks |
| 5 | **Content-safety only 3 tests** | `content-safety.test.ts` | Security filter barely tested |

### Should fix TRONG sprint tới

| # | Issue | File | Impact |
|---|-------|------|--------|
| 6 | **Duplicate test file** | `stores/builderStore.test.ts` | Maintenance overhead |
| 7 | **console.log in tests** | `f19-payments-client.test.tsx:24,41` | Noise in CI output |
| 8 | **Mocks component under test** | `dashboard-components.test.tsx:259` | Tests fabricated output |
| 9 | **No XSS tests on user inputs** | Email templates, forms | Injection risk |
| 10 | **orders.test.ts has no beforeEach** | `api/orders.test.ts` | Order-dependent tests |

---

## 4. 🟡 Missing Test Areas

| Area | Current | Needed | Priority |
|------|---------|--------|----------|
| **Auth 401/403 on API routes** | 1/7 files | All 7 files | 🔴 Critical |
| **IDOR (cross-tenant access)** | 0 tests | ≥10 tests | 🔴 Critical |
| **XSS/injection inputs** | 0 tests | ≥15 tests | 🔴 High |
| **Products CRUD API** | 2 tests | ≥15 tests | 🟡 High |
| **Orders full CRUD** | 3 tests | ≥12 tests | 🟡 High |
| **Error paths (API down)** | 2 tests | ≥10 tests | 🟡 Medium |
| **Rate limiting on APIs** | 1 file | All mutation endpoints | 🟡 Medium |
| **Content-safety edge cases** | 3 tests | ≥12 tests | 🟡 Medium |
| **Email XSS sanitization** | 0 tests | ≥5 tests | 🟡 Medium |

---

## 5. ✅ What's Working Well

| Strength | Examples |
|----------|---------|
| **Pure function tests excellent** | `dashboard-utils.test.ts` (5/5), `otp-generate.test.ts` (5/5) |
| **Store tests thorough** | `builderStore` (37 tests), `cartStore`, `editorStore` |
| **AAA pattern followed** | 90%+ of tests use Arrange-Act-Assert |
| **Meaningful test names** | Most tests describe behavior, not implementation |
| **Fake timers used correctly** | `rateLimit`, `otp-generate`, `rate-limit-auth` |
| **TC-ID mapping** | `f21-localization` maps tests to TC-F21.xx IDs |
| **Zod validation tested** | Auth forms, checkout, stripe params |

---

## 6. Action Items cho Dev Team

### Immediate (trước release 31/03)

- [ ] **Fix `products-crud.test.tsx`** — import actual `validateForm` + `formatPrice` from source
- [ ] **Fix `auth-validation.test.ts`** — import actual schemas from source pages
- [ ] **Remove `stores/builderStore.test.ts`** — duplicate of `builder/builder-store.test.ts`
- [ ] **Remove `console.log`** from `f19-payments-client.test.tsx:24,41`
- [ ] **Add `beforeEach(vi.clearAllMocks)`** to `api/orders.test.ts`

### Next Sprint

- [ ] Add 401/403 tests to all 7 API test files
- [ ] Add IDOR tests for sites, orders, products endpoints
- [ ] Add XSS input tests to email templates + forms
- [ ] Expand content-safety tests from 3 → 12+
- [ ] Expand products API tests from 2 → 15+ (full CRUD)
- [ ] Consolidate `rateLimit.test.ts` + `rate-limit-auth.test.ts`
- [ ] Replace CSS class selectors with `data-testid` in `f19-domains-client`
