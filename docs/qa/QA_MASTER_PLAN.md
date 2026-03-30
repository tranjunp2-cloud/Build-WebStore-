# QA Master Plan — ECH Prime Web v2

> **Deadline release:** 31/03/2026 | **Ngày tạo:** 26/03/2026 | **Còn 5 ngày**
> **Issues chờ test:** 22 | **Features:** 6 | **Automated tests:** 6 classes (Java + Playwright)

---

## 1. Tổng quan QA Pipeline hiện tại

```
Dev merge PR → staging deploy → Bot gắn qa:pending → Lark notify QC
                                                         ↓
                                            QC test trên staging
                                                         ↓
                                    ├── ✅ Pass → QC close issue → Done
                                    └── ❌ Fail → QC gắn qa:failed
                                                         ↓
                                              Bot chuyển board "Re-Open"
                                              Bot tạo bug report template
                                              Lark notify Dev fix
                                                         ↓
                                              Dev fix → PR mới → merge → QA lại
```

---

## 2. Danh sách issues chờ test (22 issues)

### Nhóm 1: F01 AI Builder (8 issues) — ƯU TIÊN CAO

| # | Issue | Mô tả | Test Case File |
|---|-------|-------|---------------|
| #246 | US-F01-01 | AI Generate Site from Structured Input | `F01-ai-chat-builder.md` TC-01.01 |
| #247 | US-F01-02 | Store Setup — Basic Info Form | `F01-ai-chat-builder.md` TC-01.02 |
| #248 | US-F01-03 | AI Image Generation | `F01-ai-chat-builder.md` TC-01.03 |
| #249 | US-F01-04 | One-Click Publish | `F01-ai-chat-builder.md` TC-01.04 |
| #250 | US-F01-05 | AI Builder Input Forms | `F01-ai-chat-builder.md` TC-01.05 |
| #251 | US-F01-06 | Multilingual Site Output | `F01-ai-chat-builder.md` TC-01.06 |
| #252 | US-F01-07 | Post-Generation Confirm & CMS Redirect | `F01-ai-chat-builder.md` TC-01.07 |
| #253 | US-F01-08 | Drag-and-Drop Block Reorder | `F01-ai-chat-builder.md` TC-01.08 |

### Nhóm 2: F08 Products (7 issues) — ƯU TIÊN CAO

| # | Issue | Mô tả | Test Case File |
|---|-------|-------|---------------|
| #98 | US-F08-01 | Products CRUD + Status | `F08-product-crud.md` |
| #99 | US-F08-02 | Variants & SKU | `F08-product-crud.md` |
| #100 | US-F08-03 | AI SEO Generation | `F08-product-crud.md` |
| #101 | US-F08-04 | Bulk Create AI | `F08-product-crud.md` |
| #102 | US-F08-05 | Category 3-Level | `F08-product-crud.md` |
| #103 | US-F08-06 | Attributes & Storefront | `F08-product-crud.md` |
| #195 | US-F08-07 | Mobile UX Products | `F08-product-crud.md` |

### Nhóm 3: F10 Orders (4 issues) — ƯU TIÊN TRUNG BÌNH

| # | Issue | Mô tả | Test Case File |
|---|-------|-------|---------------|
| #109 | US-F10-02 | Customer Checkout | `F10-orders-management.md` |
| #110 | US-F10-03 | Order Cancellation | `F10-orders-management.md` |
| #111 | US-F10-04 | Order Sorting & Filter | `F10-orders-management.md` |
| #197 | US-F10-05 | Mobile Order Management | `F10-orders-management.md` |

### Nhóm 4: Các features lẻ (3 issues)

| # | Issue | Feature | Test Case File |
|---|-------|---------|---------------|
| #188 | US-F03-07 | Dashboard Mobile Responsive | `F03-dashboard.md` |
| #94 | US-F06-03 | AI Feature Discovery Wizard | `F06-onboarding.md` |
| #212 | US-F21-03 | Language Preference Persistence | `F21-localization.md` |

---

## 3. Lịch test — 5 ngày (26/03 → 31/03)

| Ngày | Focus | Issues | QC Action |
|------|-------|--------|-----------|
| **26/03 (T4)** | F01 AI Builder (core) | #246, #247, #248, #249 | Test AC-1→AC-7 từng issue |
| **27/03 (T5)** | F01 còn lại + F08 core | #250-#253, #98, #99 | F01 wrap up + Products CRUD |
| **28/03 (T6)** | F08 còn lại + F10 | #100-#103, #109-#111 | Products AI + Orders |
| **29/03 (T7)** | Mobile UX + lẻ | #195, #197, #188, #94, #212 | Mobile responsive tests |
| **30/03 (CN)** | Regression + bug fix verify | Re-test qa:failed issues | Full regression |
| **31/03 (T2)** | Release sign-off | — | Final check staging → approve release |

---

## 4. Quy trình test từng issue (step-by-step cho QC)

### Bước 1: Mở issue trên GitHub
- Vào tab Issues → filter label `qa:pending`
- Hoặc vào Lark → click link trong thông báo "🧪 QA Ready"
- Đọc **Acceptance Criteria** trong issue body

### Bước 2: Mở test case tương ứng
- Vào `docs/qa/F{XX}-*.md` → tìm test case theo issue
- Mỗi test case có: Steps, Expected Result, Severity

### Bước 3: Test trên staging
- **URL:** https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app
- **Login:** phuong.ltweb@gmail.com / Aa123456@
- Test theo steps trong test case file
- Chạy **9-Point Checklist** cho mỗi feature:
  1. Loading State (spinner/skeleton)
  2. Empty State (thông báo "chưa có...")
  3. Error State (tắt internet / nhập sai)
  4. Form Validation (bỏ trống / sai format)
  5. Button States (disabled khi loading)
  6. Toast/Feedback (thông báo sau action)
  7. Auth Redirect (chưa login → /login)
  8. Mobile 375px (DevTools responsive)
  9. Console Errors (F12 không lỗi đỏ)

### Bước 4A: Test PASS
1. Comment trên issue:
```
✅ QA PASS — [Feature Name]
- Tested on: Desktop Chrome + Mobile (375px)
- Test cases: TC-XX.01 → TC-XX.0N all passed
- 9-Point Checklist: all clear
- No bugs found
```
2. Gắn label `qa:passed`
3. **Close issue** → Bot tự chuyển board "Done"

### Bước 4B: Test FAIL
1. Gắn label `qa:failed` trên issue
2. Bot tự tạo **bug report template** trong comment
3. QC **edit comment** điền thêm:
   - Mô tả lỗi cụ thể
   - Steps to Reproduce
   - Expected vs Actual
   - Screenshot (kéo thả vào comment)
   - Severity (Critical/Major/Minor/Cosmetic)
4. Bot tự chuyển board → **"Re-Open"** + Lark notify Dev
5. Dev fix → PR mới → merge → issue quay lại "QA Testing" → test lại

---

## 5. Automation Testing (Java + Playwright)

### Đã có sẵn
```
docs/qa/qa-automation/
├── pom.xml                              # Java 17 + Playwright + JUnit 5
├── src/main/java/.../BasePage.java      # Page Object Model base
└── src/test/java/.../tests/
    ├── BaseTest.java                    # Browser setup/teardown
    ├── AiChatBuilderTest.java           # F01: 10 test cases
    ├── AiEditorTest.java                # F05: editor tests
    ├── ProductsCrudTest.java            # F08: products tests
    ├── OrdersManagementTest.java        # F10: orders tests
    └── SeoDashboardTest.java            # F12: SEO tests
```

### Cách chạy
```bash
cd docs/qa/qa-automation

# Chạy tất cả tests
mvn test

# Chạy riêng 1 feature
mvn test -Dtest=AiChatBuilderTest      # F01
mvn test -Dtest=ProductsCrudTest        # F08
mvn test -Dtest=OrdersManagementTest    # F10
```

### Lưu ý
- Tests hiện tại dùng `data-testid` selectors → cần verify code FE đã có đúng testid
- BaseTest mở browser **headed** (không headless) → QC thấy UI chạy
- Cần set `BASE_URL` env var trỏ tới staging URL
- Chạy tay manual song song automated — automated không cover 100% visual/UX

---

## 6. Khi gặp lỗi staging (500, crash, etc.)

1. Mở **Betterstack Live tail**: https://telemetry.betterstack.com/team/t518152/tail
2. Filter source: `ech-prime-web-v2-staging`
3. Search keyword: `Error`, `500`, `ECONNREFUSED`
4. Screenshot log lỗi → paste vào bug report
5. Nếu cần chi tiết hơn → báo PM/DevOps check DO Runtime Logs

---

## 7. Labels QA sử dụng

| Label | Khi nào gắn | Ai gắn |
|-------|------------|--------|
| `qa:pending` | PR merged (auto) | Bot |
| `qa:failed` | Test thấy bug | QC |
| `qa:passed` | Test pass hết | QC |
| `bug` | Tạo bug issue mới | QC |

---

## 8. Metrics theo dõi

| Metric | Target | Cách đo |
|--------|--------|---------|
| **Test coverage** | 100% issues qa:pending | Tổng tested / tổng qa:pending |
| **Bug rate** | < 30% | Issues qa:failed / tổng tested |
| **Re-open rate** | < 10% | Issues qa:failed lần 2+ / tổng |
| **Test velocity** | ≥ 5 issues/ngày | Issues closed per day |
| **Release readiness** | 0 P0/P1 bugs open | Filter: bug + P0/P1 + open |

---

## 9. Release Criteria (31/03)

Điều kiện để release:

- [ ] Tất cả P0 issues: closed (QA passed)
- [ ] Tất cả P1 issues: closed hoặc có workaround documented
- [ ] 0 issues với label `qa:failed` còn open
- [ ] F01 AI Builder: 8/8 issues passed
- [ ] F08 Products: 7/7 issues passed
- [ ] Regression: no broken features from previous releases
- [ ] Staging health: Betterstack monitor = UP
- [ ] PM sign-off trên GitHub milestone
