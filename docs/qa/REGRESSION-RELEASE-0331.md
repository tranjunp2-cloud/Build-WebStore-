# Regression Test Plan — Release 31/03/2026

> **Mục đích:** Checklist cho QC team trước khi release staging → production.
> **Deadline:** 31/03/2026
> **QA Owner:** QC Team (Ary lead)

---

## 1. Tổng quan Release

| Metric | Số liệu |
|--------|---------|
| **Milestones due 31/03** | Wave 1 (CMS), Wave 3 (Editor), Wave 5 (Storefront) |
| **PRs merged (tuần 19-26/03)** | 23 PRs (features + fixes + docs) |
| **Issues qa:pending** | 22 issues chờ test |
| **Issues qa:failed** | 3 issues (#246, #133, #108) |
| **Tổng issues open** | 80 |
| **Tổng issues closed** | 45 (~36% done) |

---

## 2. Risk Assessment — Features cần regression

### 🔴 HIGH RISK (test đầy đủ)

| Feature | Lý do high risk | PRs gần đây | Test scope |
|---------|----------------|-------------|------------|
| **F02 Auth** | #333 fix SMTP + #318 mobile UX + #321 SSO | 3 PRs thay đổi auth core | Full login/register/forgot-pw flow |
| **F05 AI Editor** | #325, #323, #322, #320, #319, #313 — 6 PRs | Nhiều thay đổi nhất | Tất cả editor flows |
| **F19 Store Config** | #331 + #330 IDOR fix + #324 staff | Security fix + new features | Domains, Payments, Staff |
| **F10 Orders** | #305 complete module | Toàn bộ order module mới | CRUD + checkout + status |

### 🟡 MEDIUM RISK (smoke test + critical paths)

| Feature | Lý do | Test scope |
|---------|-------|------------|
| **F01 AI Builder** | 8 issues qa:pending, chưa test | Generate site + publish flow |
| **F08 Products** | #265 bulk create, #245 SEO gen | Products CRUD + bulk actions |
| **F18 CMS Layout** | #133 qa:failed | Main content area display |

### 🟢 LOW RISK (quick smoke)

| Feature | Lý do | Test scope |
|---------|-------|------------|
| **F03 Dashboard** | Ít thay đổi gần đây | Dashboard loads, stats hiển thị |
| **F06 Onboarding** | #295, #296 — merged 2 tuần trước | Register → onboarding → builder |
| **F21 Localization** | #212 qa:pending | Switch MY/EN, persistence |

---

## 3. Regression Checklist cho QC

### 🔴 Blocker — Phải pass trước release

- [ ] **AUTH-01:** Login bằng email/password → redirect dashboard
- [ ] **AUTH-02:** Register tài khoản mới → nhận email welcome
- [ ] **AUTH-03:** Forgot password → nhận email reset → đổi password thành công
- [ ] **AUTH-04:** Login sai password 5 lần → locked 15 phút
- [ ] **AUTH-05:** Mobile login responsive (375px)
- [ ] **EDITOR-01:** Mở editor → preview loads trong iframe
- [ ] **EDITOR-02:** Add section → chọn block → hiển thị trong preview
- [ ] **EDITOR-03:** Drag-and-drop reorder blocks
- [ ] **EDITOR-04:** Publish site → site live trên storefront URL
- [ ] **EDITOR-05:** Inline edit text → save → reflect trên preview
- [ ] **ORDER-01:** Customer checkout COD → order created
- [ ] **ORDER-02:** Order list hiển thị, filter by status
- [ ] **ORDER-03:** Update order status → Lark notify (nếu có)
- [ ] **CONFIG-01:** Domains settings → add/remove domain
- [ ] **CONFIG-02:** Payment settings → Stripe connect
- [ ] **CONFIG-03:** Staff management → invite + RBAC

### 🟡 High — Nên pass

- [ ] **BUILDER-01:** AI generate site từ business info form
- [ ] **BUILDER-02:** One-click publish sau generate
- [ ] **PRODUCT-01:** Create product with images + variants
- [ ] **PRODUCT-02:** Bulk create products via AI
- [ ] **PRODUCT-03:** Product list search/filter/sort
- [ ] **CMS-01:** CMS layout main content display (#133 fix)
- [ ] **CMS-02:** Mobile responsive CMS
- [ ] **L10N-01:** Switch language MY ↔ EN → UI updates

### 🟢 Medium — Nice to have

- [ ] **DASH-01:** Dashboard loads, stats correct
- [ ] **DASH-02:** Sidebar navigation works all links
- [ ] **ONBOARD-01:** New user → onboarding wizard → AI builder
- [ ] **SEO-01:** SEO dashboard loads, score panel visible
- [ ] **STORE-01:** Storefront public page loads
- [ ] **STORE-02:** Product listing page + product detail

---

## 4. QA Failed Issues — Phải fix trước release

| Issue | Feature | Status | Dev cần fix |
|-------|---------|--------|-------------|
| **#246** [US-F01-01] AI Builder Generate | F01 | qa:failed | AI builder generate flow broken |
| **#133** [US-F18-03] Main Content Area | F18 | qa:failed | CMS layout display issue |
| **#108** [US-F10-01] Order Management | F10 | qa:failed | Order status updates |

⚠️ **3 issues qa:failed phải fix TRƯỚC 28/03** để QC có thời gian retest.

---

## 5. Timeline

| Ngày | Task | Ai |
|------|------|-----|
| **26/03** (hôm nay) | Fix 3 qa:failed issues | Dev |
| **27/03** | Retest qa:failed + bắt đầu regression HIGH risk | QC |
| **28/03** | Regression MEDIUM + LOW risk | QC |
| **29/03** | Fix regression bugs (nếu có) | Dev |
| **30/03** | Final smoke test toàn bộ | QC + PM |
| **31/03** | Release staging → production | DevOps |

---

## 6. Entry / Exit Criteria

### Entry (bắt đầu regression khi):
- [ ] Tất cả qa:failed issues đã fix + deploy staging
- [ ] Smoke test pass (CI pipeline green)
- [ ] E2E automation pass

### Exit (release khi):
- [ ] ✅ Tất cả Blocker checklist items pass
- [ ] ✅ ≥ 90% High checklist items pass
- [ ] ✅ 0 Critical/Blocker bugs open
- [ ] ✅ ≤ 3 High bugs open (có workaround documented)
- [ ] ✅ PM sign-off
- [ ] ✅ Betterstack staging logs không có recurring errors

---

## 7. Rollback Plan

Nếu production có critical bug sau release:
1. DevOps rollback về previous deploy (DO App Platform → Activity → Redeploy previous)
2. Lark notify team: "🔴 Production rollback — [reason]"
3. Dev hotfix → PR vào main → deploy lại
4. QC smoke test production sau redeploy
