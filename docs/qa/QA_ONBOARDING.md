# QA Onboarding Guide — ECH Prime Web v2

> Hướng dẫn cho QA team bắt đầu test dự án PrimeWeb.

---

## 1. Tổng quan dự án

**PrimeWeb** là AI-powered website builder cho SMEs (Malaysia market).
- User đăng ký → mô tả business → AI tạo website → chỉnh sửa → publish
- Tech stack: Next.js 15 + Payload CMS + PostgreSQL + OpenAI

### Environments

| Environment | URL | Branch | Dùng để |
|---|---|---|---|
| **Staging** | https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app | `staging` | QA test |
| **Production** | (chưa deploy) | `main` | Live users |
| **Payload Admin** | `{URL}/admin` | — | Quản lý DB trực tiếp |

### Test accounts

| Email | Password | Role | Ghi chú |
|---|---|---|---|
| phuong.ltweb@gmail.com | Aa123456@ | Owner | Account chính |
| *(tạo mới khi test register)* | — | — | Dùng email throwaway |

---

## 2. QA Workflow

```
BA viết PRD + Acceptance Criteria
        ↓
QA viết Test Cases từ PRD (TRƯỚC khi Dev code)
        ↓
Dev code → tạo PR → CI pass (auto) → merge staging → auto deploy
        ↓
QA test trên staging theo Test Cases
        ↓
    ├── PASS → QA comment "QA PASS" trên PR/issue → merge main
    └── FAIL → QA file bug issue trên GitHub → Dev fix → re-test
```

### QA test khi nào?

- **Sau mỗi PR merge vào staging** — Lark sẽ notify "Staging Deployed"
- **Trước mỗi release** — full regression test tất cả features

### QA sign-off như thế nào?

Comment trên GitHub PR hoặc issue:
```
✅ QA PASS — [Feature Name]
- Tested on: Desktop Chrome + iPhone 14 (responsive)
- Test cases: TC-01 → TC-08 all passed
- No bugs found
```

Hoặc nếu có bug:
```
❌ QA FAIL — [Feature Name]
- TC-03: FAIL — xem bug #XX
- TC-05: FAIL — xem bug #XX
- Các test case khác: PASS
```

---

## 3. Cách file bug

Tạo GitHub Issue với format:

**Title**: `[BUG] [Feature] Mô tả ngắn`
Ví dụ: `[BUG] [Auth] Login không redirect về trang trước đó`

**Labels**: `bug` + `feature:F0X`

**Body**:
```markdown
## Mô tả
Khi login từ trang /dashboard, sau khi đăng nhập thành công
không redirect về /dashboard mà ở lại trang /login.

## Steps to Reproduce
1. Mở trình duyệt ẩn danh (incognito)
2. Truy cập /dashboard → bị redirect về /login?redirect=/dashboard
3. Đăng nhập với email: phuong.ltweb@gmail.com / Aa123456@
4. Sau khi login thành công

## Expected
Redirect về /dashboard

## Actual
Ở lại trang /login (hoặc redirect về /)

## Environment
- Browser: Chrome 120 / Safari 17
- Device: Desktop / iPhone 14
- URL staging: https://ech-prime-web-v2-staging-xxx.ondigitalocean.app

## Screenshot / Video
(đính kèm screenshot hoặc screen recording)
```

---

## 4. Cách test

### Tools cần thiết
- **Chrome DevTools** — F12 để test responsive (iPhone 14: 390x844, iPad: 820x1180)
- **Incognito mode** — test auth flow không bị cache cookie
- **Network tab** — check API calls có lỗi không (status 4xx, 5xx)

### Checklist mỗi feature (9-Point Checklist)

| # | Check | Cách test |
|---|---|---|
| 1 | **Loading State** | Click button → có spinner/skeleton không? |
| 2 | **Empty State** | Xóa hết data → UI có thông báo "chưa có..." không? |
| 3 | **Error State** | Tắt internet / nhập sai → có thông báo lỗi không? |
| 4 | **Form Validation** | Bỏ trống field / nhập sai format → có báo lỗi không? |
| 5 | **Button States** | Button disabled khi đang loading? Hover có hiệu ứng? |
| 6 | **Toast/Feedback** | Sau action thành công → có toast/thông báo không? |
| 7 | **Auth Redirect** | Chưa login → bị redirect /login? Đã login → không thấy /login? |
| 8 | **Mobile 375px** | Mở DevTools → iPhone SE (375px) → UI không bị vỡ? |
| 9 | **Console Errors** | Mở F12 Console → không có lỗi đỏ? |

---

## 5. Danh sách features cần test

| Feature | Route | PRD | Test Cases |
|---|---|---|---|
| F02: Auth | /login, /register, /forgot-password | docs/prd/F02-auth.md | docs/qa/TC-F02-auth.md |
| F03: Dashboard | /dashboard | docs/prd/F03-dashboard.md | docs/qa/TC-F03-dashboard.md |
| F01: AI Builder | /builder/new | docs/prd/F01-ai-chat-builder.md | docs/qa/TC-F01-builder.md |
| F05: Editor | /editor/:siteId | docs/prd/F05-ai-editor.md | docs/qa/TC-F05-editor.md |
| F07: Templates | /templates | — | docs/qa/TC-F07-templates.md |
| F09: Products | /dashboard/products | — | docs/qa/TC-F09-products.md |
| F11: Orders | /dashboard/orders | — | docs/qa/TC-F11-orders.md |
| F12: SEO | /dashboard/seo | — | docs/qa/TC-F12-seo.md |

---

## 6. Glossary

| Thuật ngữ | Nghĩa |
|---|---|
| **Staging** | Môi trường test, code mới nhất, có thể có bug |
| **Production** | Môi trường live, chỉ code đã QA pass |
| **PR** | Pull Request — Dev gửi code để review |
| **CI** | Continuous Integration — hệ thống tự động test code |
| **Regression** | Test lại features cũ để đảm bảo không bị hỏng |
| **Happy path** | Flow chính, user làm đúng mọi thứ |
| **Edge case** | Trường hợp đặc biệt (input rỗng, mạng chậm, v.v.) |
| **Acceptance Criteria** | Điều kiện để feature được coi là "done" (viết trong PRD) |
