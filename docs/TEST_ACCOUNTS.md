# Test Accounts & Utilities

## Test Account

| Field | Value |
|-------|-------|
| Email | `test@primeweb.app` |
| Password | `Test@12345` |
| Tenant | Test Store (`test-store`) |
| Role | `tenant-owner` |

> **OTP bypass:** Local dev (`NODE_ENV !== production`) — nhap bat ky 6 so nao (vd: `000000`) deu pass OTP.

---

## Reset Account Command

```bash
pnpm db:reset                    # reset test@primeweb.app (mac dinh)
pnpm db:reset demo@primeweb.app  # reset account khac
```

### Tac dung
1. Xoa tat ca websites + pages cua user
2. Xoa analytics data cua tenant
3. Reset OTP state, `has_seen_ai_wizard`, AI generation count
4. User login lai → dashboard trong → "Build with AI" CTA

### KHONG xoa
- Account (user van login duoc)
- Templates mau (global, khong bi anh huong)
- Users/data khac
- Tenant (chi reset counter)

### Khi nao dung
- Test flow "Build Website" tu dau
- Test onboarding / empty state
- Lam sach data cu truoc khi test feature moi

---

## Seed Commands

```bash
pnpm db:seed       # Tao demo account (demo@primeweb.app / password123) + sample site
pnpm db:seed-sso   # Tao SSO test account
```

---

## Dev Mode Features

| Feature | Behavior |
|---------|----------|
| OTP bypass | Nhap bat ky 6 so → pass verification |
| OTP console log | Terminal hien OTP code thuc (neu can test flow that) |
| OTP TTL | 30 phut (production: 5 phut) |
